import mongoose from "mongoose";
import Comment from "../models/Comment.js";
import Match from "../models/Match.js";
import Highlight from "../models/Highlight.js";

const publicUserFields = "name email avatar handle is_verified";

const isObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

const serializeComment = (comment, currentUserId = "") => ({
  id: comment._id.toString(),
  match_id: comment.match_id?.toString?.() || null,
  highlight_id: comment.highlight_id?.toString?.() || null,
  comment: comment.comment,
  likes_count: comment.likes_count || 0,
  liked: Boolean(currentUserId && comment.liked_by?.some((id) => id.toString() === currentUserId)),
  created_at: comment.created_at,
  updated_at: comment.updated_at,
  user: comment.user_id?.name
    ? {
        id: comment.user_id._id.toString(),
        name: comment.user_id.name,
        handle: comment.user_id.handle || comment.user_id.name.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 18),
        avatar: comment.user_id.avatar,
        verified: Boolean(comment.user_id.is_verified),
      }
    : null,
});

const getFilter = ({ matchId, highlightId }) => {
  if (matchId && isObjectId(matchId)) return { match_id: matchId };
  if (highlightId && isObjectId(highlightId)) return { highlight_id: highlightId };
  return null;
};

export const getComments = async (req, res, next) => {
  try {
    const filter = getFilter(req.query);
    if (!filter) return res.status(400).json({ message: "matchId or highlightId is required" });

    const comments = await Comment.find(filter)
      .sort({ created_at: -1 })
      .limit(100)
      .populate("user_id", publicUserFields);

    res.json({
      comments: comments.map((comment) => serializeComment(comment, req.user?._id?.toString?.())),
      count: comments.length,
    });
  } catch (error) {
    next(error);
  }
};

export const createComment = async (req, res, next) => {
  try {
    const { match_id, highlight_id, comment } = req.body;
    const text = String(comment || "").trim();

    if (!text) return res.status(400).json({ message: "Comment is required" });
    if (text.length > 280) return res.status(400).json({ message: "Comment is too long" });

    let matchId = isObjectId(match_id) ? match_id : null;
    let highlightId = isObjectId(highlight_id) ? highlight_id : null;

    if (!matchId && !highlightId) return res.status(400).json({ message: "match_id or highlight_id is required" });

    if (highlightId && !matchId) {
      const highlight = await Highlight.findById(highlightId);
      if (!highlight) return res.status(404).json({ message: "Highlight not found" });
      matchId = highlight.match_id;
    }

    if (matchId) {
      const match = await Match.findById(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });
    }

    const created = await Comment.create({
      match_id: matchId,
      highlight_id: highlightId,
      user_id: req.user._id,
      comment: text,
    });
    await created.populate("user_id", publicUserFields);

    res.status(201).json({ comment: serializeComment(created, req.user._id.toString()) });
  } catch (error) {
    next(error);
  }
};

export const toggleCommentLike = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id).populate("user_id", publicUserFields);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const userId = req.user._id.toString();
    const liked = comment.liked_by.some((id) => id.toString() === userId);

    if (liked) {
      comment.liked_by = comment.liked_by.filter((id) => id.toString() !== userId);
    } else {
      comment.liked_by.push(req.user._id);
    }

    comment.likes_count = comment.liked_by.length;
    await comment.save();
    await comment.populate("user_id", publicUserFields);

    res.json({ comment: serializeComment(comment, userId) });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can delete only your comment" });
    }

    await comment.deleteOne();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
