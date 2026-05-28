import dotenv from "dotenv";
import mongoose from "mongoose";
import Conversation from "../server/models/Conversation.js";
import ConversationMember from "../server/models/ConversationMember.js";
import Highlight from "../server/models/Highlight.js";
import Match from "../server/models/Match.js";
import Message from "../server/models/Message.js";
import MessageReaction from "../server/models/MessageReaction.js";
import Scorecard from "../server/models/Scorecard.js";
import User from "../server/models/User.js";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

const targetUser =
  (await User.findOne({ name: "Shaan Dan" })) ||
  (await User.findOne({ handle: "shahnawazshanu" })) ||
  (await User.findOne({}).sort({ updatedAt: -1 }));

if (!targetUser) {
  throw new Error("No app user found to attach the demo chat to.");
}

const demoUser = await User.findOneAndUpdate(
  { email: "demo-chat@crickpulse.local" },
  {
    $set: {
      name: "CrickPulse Coach",
      handle: "crickpulsecoach",
      avatar: "https://api.dicebear.com/9.x/initials/svg?seed=CrickPulse%20Coach",
      bio: "Demo chat teammate for testing shares and media.",
      location: "CrickPulse Arena",
      player_role: "Coach",
      is_verified: true,
      authProvider: "manual",
    },
  },
  { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
);

const match = await Match.findOneAndUpdate(
  { user_id: targetUser._id, match_name: "Demo Chat Showcase" },
  {
    $set: {
      user_id: targetUser._id,
      match_name: "Demo Chat Showcase",
      location: "Nehru Stadium, Indore",
      team_a: "Kings XI",
      team_b: "Royal Strikers",
      video_url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      video_file_name: "demo-highlight.mp4",
      video_size: 3500000,
      thumbnail_url: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=900&q=80",
      match_result: "Kings XI won by 18 runs",
      runs_scored: 45,
      wickets_taken: 2,
      strike_rate: 150,
      status: "active",
    },
  },
  { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
);

const scorecard = await Scorecard.findOneAndUpdate(
  { match_id: match._id, player_id: targetUser._id },
  {
    $set: {
      match_id: match._id,
      player_id: targetUser._id,
      runs: 45,
      balls: 30,
      fours: 5,
      sixes: 2,
      strike_rate: 150,
      wickets: 2,
      overs: 3,
      economy: 6.2,
      catches: 1,
      run_outs: 0,
    },
  },
  { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
);

const highlight = await Highlight.findOneAndUpdate(
  { user_id: targetUser._id, match_id: match._id, title: "Demo cover drive highlight" },
  {
    $set: {
      user_id: targetUser._id,
      match_id: match._id,
      title: "Demo cover drive highlight",
      caption: "Pure timing through extra cover. Built for CrickPulse reels.",
      video_url: match.video_url,
      thumbnail_url: match.thumbnail_url,
    },
  },
  { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
);

const memberships = await ConversationMember.find({ user_id: targetUser._id }).select("conversation_id");
const demoMembership = await ConversationMember.findOne({
  user_id: demoUser._id,
  conversation_id: { $in: memberships.map((member) => member.conversation_id) },
}).select("conversation_id");

let conversation = demoMembership ? await Conversation.findById(demoMembership.conversation_id) : null;

if (!conversation) {
  conversation = await Conversation.create({ created_by: targetUser._id, type: "direct" });
  await ConversationMember.create([
    { conversation_id: conversation._id, user_id: targetUser._id, role: "owner", last_read_at: new Date(Date.now() - 600000) },
    { conversation_id: conversation._id, user_id: demoUser._id, role: "member", last_read_at: new Date() },
  ]);
} else {
  const oldMessages = await Message.find({ conversation_id: conversation._id }).select("_id");
  await MessageReaction.deleteMany({ message_id: { $in: oldMessages.map((message) => message._id) } });
  await Message.deleteMany({ conversation_id: conversation._id });
  await ConversationMember.updateOne(
    { conversation_id: conversation._id, user_id: targetUser._id },
    { $set: { last_read_at: new Date(Date.now() - 600000) } },
  );
  await ConversationMember.updateOne(
    { conversation_id: conversation._id, user_id: demoUser._id },
    { $set: { last_read_at: new Date() } },
  );
}

const now = Date.now();
const createdMessages = await Message.insertMany([
  {
    conversation_id: conversation._id,
    sender_id: demoUser._id,
    message_type: "text",
    text: "Hey, this is a demo chat. You can test normal messages here.",
    status: "seen",
    created_at: new Date(now - 540000),
  },
  {
    conversation_id: conversation._id,
    sender_id: targetUser._id,
    message_type: "text",
    text: "Perfect. Show me everything CrickPulse can share in chat.",
    status: "delivered",
    created_at: new Date(now - 500000),
  },
  {
    conversation_id: conversation._id,
    sender_id: demoUser._id,
    message_type: "image",
    text: "Photo message preview",
    media_url: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=900&q=80",
    thumbnail_url: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=480&q=70",
    status: "delivered",
    created_at: new Date(now - 460000),
  },
  {
    conversation_id: conversation._id,
    sender_id: demoUser._id,
    message_type: "video",
    text: "Video message preview",
    media_url: match.video_url,
    thumbnail_url: match.thumbnail_url,
    status: "delivered",
    created_at: new Date(now - 420000),
  },
  {
    conversation_id: conversation._id,
    sender_id: demoUser._id,
    message_type: "audio",
    text: "Voice note",
    media_url: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
    status: "delivered",
    created_at: new Date(now - 380000),
  },
  {
    conversation_id: conversation._id,
    sender_id: demoUser._id,
    message_type: "feed",
    text: "Shared from Feed",
    shared_ref_type: "feed",
    shared_ref_id: match._id.toString(),
    metadata: {
      title: "Feed post: Demo Chat Showcase",
      subtitle: "Kings XI vs Royal Strikers - Nehru Stadium",
      thumbnail: match.thumbnail_url,
    },
    status: "delivered",
    created_at: new Date(now - 340000),
  },
  {
    conversation_id: conversation._id,
    sender_id: demoUser._id,
    message_type: "scorecard",
    text: "Shared scorecard card",
    shared_ref_type: "scorecard",
    shared_ref_id: scorecard._id.toString(),
    metadata: {
      title: "Scorecard: 45 off 30",
      subtitle: "2 wickets - SR 150 - 5 fours / 2 sixes",
      thumbnail: match.thumbnail_url,
    },
    status: "delivered",
    created_at: new Date(now - 300000),
  },
  {
    conversation_id: conversation._id,
    sender_id: demoUser._id,
    message_type: "profile",
    text: "Shared player profile",
    shared_ref_type: "profile",
    shared_ref_id: targetUser._id.toString(),
    metadata: {
      title: `Player profile: ${targetUser.name}`,
      subtitle: `@${targetUser.handle || "player"} - ${targetUser.player_role || "All-Rounder"}`,
      thumbnail: targetUser.avatar || "",
    },
    status: "delivered",
    created_at: new Date(now - 260000),
  },
  {
    conversation_id: conversation._id,
    sender_id: demoUser._id,
    message_type: "match",
    text: "Shared match details",
    shared_ref_type: "match",
    shared_ref_id: match._id.toString(),
    metadata: {
      title: match.match_name,
      subtitle: `${match.team_a} vs ${match.team_b} - ${match.match_result}`,
      thumbnail: match.thumbnail_url,
    },
    status: "delivered",
    created_at: new Date(now - 220000),
  },
  {
    conversation_id: conversation._id,
    sender_id: demoUser._id,
    message_type: "highlight",
    text: "Shared highlight reel",
    shared_ref_type: "highlight",
    shared_ref_id: highlight._id.toString(),
    metadata: {
      title: highlight.title,
      subtitle: highlight.caption,
      thumbnail: highlight.thumbnail_url,
    },
    status: "delivered",
    created_at: new Date(now - 180000),
  },
  {
    conversation_id: conversation._id,
    sender_id: demoUser._id,
    message_type: "text",
    text: "That is every chat type: text, photo, video, audio, feed, scorecard, profile, match, and highlight.",
    status: "delivered",
    created_at: new Date(now - 120000),
  },
]);

await MessageReaction.create({
  message_id: createdMessages[9]._id,
  user_id: targetUser._id,
  reaction: "heart",
});

await Conversation.findByIdAndUpdate(conversation._id, {
  $set: {
    last_message: "That is every chat type: text, photo, video, audio, feed, scorecard, profile, match, and highlight.",
    last_message_type: "text",
    last_message_at: new Date(now - 120000),
  },
});

console.log(
  JSON.stringify(
    {
      ok: true,
      user: targetUser.name,
      conversationId: conversation._id.toString(),
      messages: createdMessages.length,
      matchId: match._id.toString(),
      scorecardId: scorecard._id.toString(),
      highlightId: highlight._id.toString(),
    },
    null,
    2,
  ),
);

await mongoose.disconnect();
