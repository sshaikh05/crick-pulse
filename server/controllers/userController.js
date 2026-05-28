import mongoose from "mongoose";
import Follow from "../models/Follow.js";
import User from "../models/User.js";

const isObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

const makeHandle = (user) =>
  (user.handle || user.name || user.email?.split("@")[0] || "player")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 28) || "player";

const serializeUser = (user, followingIds = new Set(), currentUserId = "") => ({
  id: user._id.toString(),
  username: user.name,
  name: user.name,
  handle: makeHandle(user),
  email: user.email,
  avatar_url: user.avatar || "",
  avatar: user.avatar || null,
  bio: user.bio || "",
  location: user.location || "",
  player_role: user.player_role || "All-Rounder",
  followers_count: user.followers_count || 0,
  following_count: user.following_count || 0,
  is_following: followingIds.has(user._id.toString()),
  is_self: user._id.toString() === currentUserId,
  verified: Boolean(user.is_verified),
  created_at: user.createdAt,
});

const refreshFollowCounts = async (userIds) => {
  await Promise.all(
    [...new Set(userIds.map((id) => id.toString()))].map(async (userId) => {
      const [followers, following] = await Promise.all([
        Follow.countDocuments({ following_id: userId }),
        Follow.countDocuments({ follower_id: userId }),
      ]);
      await User.findByIdAndUpdate(userId, {
        followers_count: followers,
        following_count: following,
      });
    }),
  );
};

export const searchUsers = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = q
      ? {
          _id: { $ne: req.user._id },
          $or: [
            { name: new RegExp(q, "i") },
            { email: new RegExp(q, "i") },
            { handle: new RegExp(q, "i") },
            { player_role: new RegExp(q, "i") },
            { location: new RegExp(q, "i") },
          ],
        }
      : { _id: { $ne: req.user._id } };

    const [users, follows] = await Promise.all([
      User.find(filter).sort({ followers_count: -1, updatedAt: -1 }).limit(30),
      Follow.find({ follower_id: req.user._id }).select("following_id"),
    ]);
    const followingIds = new Set(follows.map((follow) => follow.following_id.toString()));

    res.json({
      users: users.map((user) => serializeUser(user, followingIds, req.user._id.toString())),
    });
  } catch (error) {
    next(error);
  }
};

export const followUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (!isObjectId(targetId)) return res.status(400).json({ message: "Valid user id is required" });
    if (targetId === req.user._id.toString()) return res.status(400).json({ message: "You cannot follow yourself" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Player not found" });

    await Follow.updateOne(
      { follower_id: req.user._id, following_id: target._id },
      { $setOnInsert: { follower_id: req.user._id, following_id: target._id } },
      { upsert: true },
    );
    await refreshFollowCounts([req.user._id, target._id]);

    const freshTarget = await User.findById(target._id);
    res.json({
      following: true,
      user: serializeUser(freshTarget, new Set([target._id.toString()]), req.user._id.toString()),
    });
  } catch (error) {
    if (error?.code === 11000) return res.json({ following: true });
    next(error);
  }
};

export const unfollowUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (!isObjectId(targetId)) return res.status(400).json({ message: "Valid user id is required" });
    if (targetId === req.user._id.toString()) return res.status(400).json({ message: "You cannot unfollow yourself" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Player not found" });

    await Follow.deleteOne({ follower_id: req.user._id, following_id: target._id });
    await refreshFollowCounts([req.user._id, target._id]);

    const freshTarget = await User.findById(target._id);
    res.json({
      following: false,
      user: serializeUser(freshTarget, new Set(), req.user._id.toString()),
    });
  } catch (error) {
    next(error);
  }
};

export const getFollowers = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: "Valid user id is required" });
    const follows = await Follow.find({ following_id: req.params.id })
      .sort({ created_at: -1 })
      .populate("follower_id");
    const myFollows = await Follow.find({ follower_id: req.user._id }).select("following_id");
    const followingIds = new Set(myFollows.map((follow) => follow.following_id.toString()));
    res.json({
      users: follows
        .filter((follow) => follow.follower_id)
        .map((follow) => serializeUser(follow.follower_id, followingIds, req.user._id.toString())),
    });
  } catch (error) {
    next(error);
  }
};

export const getFollowing = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: "Valid user id is required" });
    const follows = await Follow.find({ follower_id: req.params.id })
      .sort({ created_at: -1 })
      .populate("following_id");
    const myFollows = await Follow.find({ follower_id: req.user._id }).select("following_id");
    const followingIds = new Set(myFollows.map((follow) => follow.following_id.toString()));
    res.json({
      users: follows
        .filter((follow) => follow.following_id)
        .map((follow) => serializeUser(follow.following_id, followingIds, req.user._id.toString())),
    });
  } catch (error) {
    next(error);
  }
};
