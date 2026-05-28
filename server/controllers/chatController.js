import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import ConversationMember from "../models/ConversationMember.js";
import Highlight from "../models/Highlight.js";
import Match from "../models/Match.js";
import Message from "../models/Message.js";
import MessageReaction from "../models/MessageReaction.js";
import Scorecard from "../models/Scorecard.js";
import User from "../models/User.js";

const userFields = "name email avatar handle is_verified";
const VALID_MESSAGE_TYPES = new Set(["text", "image", "video", "audio", "feed", "scorecard", "profile", "match", "highlight"]);
const VALID_SHARED_TYPES = new Set(["feed", "scorecard", "profile", "match", "highlight", ""]);

const getBaseUrl = (req) => `${req.protocol}://${req.get("host")}`;
const isObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

const serializeUser = (user) => ({
  id: user?._id?.toString?.() || "",
  name: user?.name || "Player",
  handle: user?.handle || user?.name?.toLowerCase?.().replace(/[^a-z0-9_]+/g, "").slice(0, 18) || "player",
  avatar: user?.avatar || null,
  verified: Boolean(user?.is_verified),
});

const assertMember = async (conversationId, userId) => {
  const member = await ConversationMember.findOne({ conversation_id: conversationId, user_id: userId });
  if (!member) {
    const error = new Error("Conversation not found");
    error.status = 404;
    throw error;
  }
  return member;
};

const serializeMessage = async (message, currentUserId) => {
  const reactions = await MessageReaction.find({ message_id: message._id });
  return {
    id: message._id.toString(),
    conversation_id: message.conversation_id?.toString?.() || "",
    sender_id: message.sender_id?._id?.toString?.() || message.sender_id?.toString?.() || "",
    sender: message.sender_id?.name ? serializeUser(message.sender_id) : null,
    message_type: message.message_type,
    text: message.text || "",
    media_url: message.media_url || "",
    thumbnail_url: message.thumbnail_url || "",
    shared_ref_type: message.shared_ref_type || "",
    shared_ref_id: message.shared_ref_id || "",
    metadata: message.metadata || {},
    status: message.status,
    reactions: reactions.map((reaction) => ({
      id: reaction._id.toString(),
      user_id: reaction.user_id.toString(),
      reaction: reaction.reaction,
      mine: reaction.user_id.toString() === currentUserId,
    })),
    created_at: message.created_at,
    updated_at: message.updated_at,
  };
};

const summarizeMessage = (message) => {
  if (!message) return "";
  if (message.text) return message.text.slice(0, 120);
  if (message.message_type === "image") return "Photo";
  if (message.message_type === "video") return "Video";
  if (message.message_type === "audio") return "Voice note";
  return `Shared ${message.shared_ref_type || message.message_type}`;
};

const validateSharedRef = async (type, id, currentUserId) => {
  if (!type) return;
  if (!isObjectId(id)) {
    const error = new Error("Shared item is invalid");
    error.status = 400;
    throw error;
  }

  const exists = type === "profile"
    ? await User.exists({ _id: id })
    : type === "scorecard"
      ? await Scorecard.exists({ _id: id })
      : type === "highlight"
        ? await Highlight.exists({ _id: id })
        : await Match.exists({ _id: id });

  if (!exists) {
    const error = new Error("Shared item not found");
    error.status = 404;
    throw error;
  }

  if (type === "scorecard") {
    const allowed = await Scorecard.exists({ _id: id, player_id: currentUserId });
    if (!allowed) {
      const error = new Error("You cannot share this scorecard");
      error.status = 403;
      throw error;
    }
  }
};

const serializeConversation = async (conversation, currentUserId) => {
  const [members, lastMessage, unreadCount] = await Promise.all([
    ConversationMember.find({ conversation_id: conversation._id }).populate("user_id", userFields),
    Message.findOne({ conversation_id: conversation._id }).sort({ created_at: -1 }).populate("sender_id", userFields),
    ConversationMember.findOne({ conversation_id: conversation._id, user_id: currentUserId }).then(async (member) => {
      const filter = {
        conversation_id: conversation._id,
        sender_id: { $ne: currentUserId },
        ...(member?.last_read_at ? { created_at: { $gt: member.last_read_at } } : {}),
      };
      return Message.countDocuments(filter);
    }),
  ]);
  const otherMembers = members.filter((member) => member.user_id?._id?.toString?.() !== currentUserId);

  return {
    id: conversation._id.toString(),
    type: conversation.type,
    created_by: conversation.created_by.toString(),
    last_message: conversation.last_message || summarizeMessage(lastMessage),
    last_message_type: conversation.last_message_type || lastMessage?.message_type || "text",
    last_message_at: conversation.last_message_at || lastMessage?.created_at || conversation.updated_at,
    unread_count: unreadCount,
    online: false,
    typing: false,
    members: members.map((member) => ({
      id: member._id.toString(),
      user: serializeUser(member.user_id),
      role: member.role,
      joined_at: member.joined_at,
      last_read_at: member.last_read_at,
    })),
    peer: serializeUser(otherMembers[0]?.user_id || members[0]?.user_id),
  };
};

export const searchChatUsers = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = q
      ? {
          _id: { $ne: req.user._id },
          $or: [
            { name: new RegExp(q, "i") },
            { email: new RegExp(q, "i") },
            { handle: new RegExp(q, "i") },
          ],
        }
      : { _id: { $ne: req.user._id } };

    const users = await User.find(filter).select(userFields).limit(20);
    res.json({ users: users.map(serializeUser) });
  } catch (error) {
    next(error);
  }
};

export const getConversations = async (req, res, next) => {
  try {
    const memberships = await ConversationMember.find({ user_id: req.user._id }).select("conversation_id");
    const conversationIds = memberships.map((member) => member.conversation_id);
    const conversations = await Conversation.find({ _id: { $in: conversationIds } }).sort({ last_message_at: -1, updated_at: -1 });
    res.json({ conversations: await Promise.all(conversations.map((conversation) => serializeConversation(conversation, req.user._id.toString()))) });
  } catch (error) {
    next(error);
  }
};

export const createOrOpenConversation = async (req, res, next) => {
  try {
    const { user_id, target_user_id, type = "direct" } = req.body;
    const targetUserId = user_id || target_user_id;
    if (!isObjectId(targetUserId)) return res.status(400).json({ message: "Valid target_user_id is required" });
    if (targetUserId === req.user._id.toString()) return res.status(400).json({ message: "Choose another player" });

    const other = await User.findById(targetUserId);
    if (!other) return res.status(404).json({ message: "User not found" });

    const myMemberships = await ConversationMember.find({ user_id: req.user._id }).select("conversation_id");
    const otherMembership = await ConversationMember.find({
      user_id: targetUserId,
      conversation_id: { $in: myMemberships.map((member) => member.conversation_id) },
    }).select("conversation_id");
    const existing = otherMembership.length
      ? await Conversation.findOne({ _id: { $in: otherMembership.map((member) => member.conversation_id) }, type: "direct" })
      : null;

    if (existing) {
      return res.status(200).json({ conversation: await serializeConversation(existing, req.user._id.toString()) });
    }

    const conversation = await Conversation.create({ created_by: req.user._id, type });
    await ConversationMember.create([
      { conversation_id: conversation._id, user_id: req.user._id, role: "owner", last_read_at: new Date() },
      { conversation_id: conversation._id, user_id: targetUserId, role: "member" },
    ]);

    res.status(201).json({ conversation: await serializeConversation(conversation, req.user._id.toString()) });
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    await assertMember(req.params.conversationId, req.user._id);
    const messages = await Message.find({ conversation_id: req.params.conversationId })
      .sort({ created_at: 1 })
      .limit(200)
      .populate("sender_id", userFields);
    res.json({ messages: await Promise.all(messages.map((message) => serializeMessage(message, req.user._id.toString()))) });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const {
      conversation_id,
      message_type = "text",
      text = "",
      media_url = "",
      thumbnail_url = "",
      shared_ref_type = "",
      shared_ref_id = "",
      metadata = {},
    } = req.body;

    if (!isObjectId(conversation_id)) return res.status(400).json({ message: "conversation_id is required" });
    await assertMember(conversation_id, req.user._id);

    const selectedType = VALID_MESSAGE_TYPES.has(message_type) ? message_type : "text";
    const selectedSharedType = VALID_SHARED_TYPES.has(shared_ref_type) ? shared_ref_type : "";
    const cleanText = String(text || "").trim();
    await validateSharedRef(selectedSharedType, shared_ref_id, req.user._id);

    if (!cleanText && !media_url && !selectedSharedType) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const message = await Message.create({
      conversation_id,
      sender_id: req.user._id,
      message_type: selectedSharedType || selectedType,
      text: cleanText,
      media_url,
      thumbnail_url,
      shared_ref_type: selectedSharedType,
      shared_ref_id: selectedSharedType ? String(shared_ref_id || "") : "",
      metadata,
      status: "delivered",
    });
    await message.populate("sender_id", userFields);

    await Conversation.findByIdAndUpdate(conversation_id, {
      last_message: summarizeMessage(message),
      last_message_type: message.message_type,
      last_message_at: message.created_at,
    });

    res.status(201).json({ message: await serializeMessage(message, req.user._id.toString()) });
  } catch (error) {
    next(error);
  }
};

export const uploadMessageMedia = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Media file is required" });

  const mediaUrl = `${getBaseUrl(req)}/uploads/messages/${req.file.filename}`;
  const kind = req.file.mimetype.startsWith("image/")
    ? "image"
    : req.file.mimetype.startsWith("video/")
      ? "video"
      : "audio";

  res.status(201).json({
    media: {
      media_url: mediaUrl,
      thumbnail_url: kind === "image" ? mediaUrl : "",
      message_type: kind,
      file_name: req.file.originalname,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
    },
  });
};

export const markMessageRead = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Message not found" });
    await assertMember(message.conversation_id, req.user._id);
    await ConversationMember.findOneAndUpdate(
      { conversation_id: message.conversation_id, user_id: req.user._id },
      { last_read_at: new Date() },
    );
    message.status = "seen";
    await message.save();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const toggleMessageReaction = async (req, res, next) => {
  try {
    const { reaction = "❤️" } = req.body;
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Message not found" });
    await assertMember(message.conversation_id, req.user._id);

    const existing = await MessageReaction.findOne({ message_id: message._id, user_id: req.user._id, reaction });
    if (existing) await existing.deleteOne();
    else await MessageReaction.create({ message_id: message._id, user_id: req.user._id, reaction });

    const populated = await Message.findById(message._id).populate("sender_id", userFields);
    res.json({ message: await serializeMessage(populated, req.user._id.toString()) });
  } catch (error) {
    next(error);
  }
};
