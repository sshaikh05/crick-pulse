import mongoose from "mongoose";
import User from "../models/User.js";
import Match from "../models/Match.js";
import Scorecard from "../models/Scorecard.js";
import Highlight from "../models/Highlight.js";
import Follow from "../models/Follow.js";

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const makeHandle = (user) =>
  (user.handle || user.name || user.email?.split("@")[0] || "player")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 28) || "player";

const round = (value, places = 1) => Number((value || 0).toFixed(places));

const serializeUserProfile = (user, stats) => ({
  id: user._id.toString(),
  username: user.name,
  handle: makeHandle(user),
  email: user.email,
  avatar_url: user.avatar || "",
  bio: user.bio || "",
  location: user.location || "",
  player_role: user.player_role || "All-Rounder",
  followers_count: user.followers_count || 0,
  following_count: user.following_count || 0,
  verified: Boolean(user.is_verified),
  created_at: user.createdAt,
  updated_at: user.updatedAt,
  ...stats,
});

const serializeMatch = (match, scorecard = null) => ({
  id: match._id.toString(),
  user_id: match.user_id?.toString?.() || "",
  match_name: match.match_name,
  team_a: match.team_a || "",
  team_b: match.team_b || "",
  location: match.location || "",
  video_url: match.video_url || "",
  thumbnail_url: match.thumbnail_url || "",
  match_result: match.match_result || "",
  runs_scored: scorecard?.runs ?? match.runs_scored ?? 0,
  wickets_taken: scorecard?.wickets ?? match.wickets_taken ?? 0,
  strike_rate: scorecard?.strike_rate ?? match.strike_rate ?? 0,
  status: match.status,
  created_at: match.created_at,
  scorecard: scorecard ? serializeScorecard(scorecard, match) : null,
});

const serializeScorecard = (scorecard, match = null) => ({
  id: scorecard._id.toString(),
  match_id: scorecard.match_id?._id?.toString?.() || scorecard.match_id?.toString?.() || "",
  player_id: scorecard.player_id?.toString?.() || "",
  runs: scorecard.runs || 0,
  balls: scorecard.balls || 0,
  fours: scorecard.fours || 0,
  sixes: scorecard.sixes || 0,
  strike_rate: scorecard.strike_rate || 0,
  wickets: scorecard.wickets || 0,
  overs: scorecard.overs || 0,
  economy: scorecard.economy || 0,
  catches: scorecard.catches || 0,
  run_outs: scorecard.run_outs || 0,
  created_at: scorecard.created_at,
  match: match
    ? {
        id: match._id.toString(),
        match_name: match.match_name,
        team_a: match.team_a || "",
        team_b: match.team_b || "",
        location: match.location || "",
        thumbnail_url: match.thumbnail_url || "",
        video_url: match.video_url || "",
        match_result: match.match_result || "",
        status: match.status,
        created_at: match.created_at,
      }
    : null,
});

const serializeHighlight = (highlight) => ({
  id: highlight._id.toString(),
  user_id: highlight.user_id?.toString?.() || "",
  match_id: highlight.match_id?._id?.toString?.() || highlight.match_id?.toString?.() || "",
  video_url: highlight.video_url,
  thumbnail_url: highlight.thumbnail_url || "",
  title: highlight.title || "Match highlight",
  created_at: highlight.created_at,
  match: highlight.match_id?.match_name
    ? {
        id: highlight.match_id._id.toString(),
        match_name: highlight.match_id.match_name,
        team_a: highlight.match_id.team_a || "",
        team_b: highlight.match_id.team_b || "",
      }
    : null,
});

export const getProfileBundle = async (userId) => {
  if (!isObjectId(userId)) {
    const error = new Error("Profile not found");
    error.status = 404;
    throw error;
  }

  const [user, matches, highlights] = await Promise.all([
    User.findById(userId),
    Match.find({ user_id: userId, status: { $in: ["active", "published"] } }).sort({ created_at: -1 }),
    Highlight.find({ user_id: userId }).sort({ created_at: -1 }).limit(24).populate("match_id", "match_name team_a team_b"),
  ]);

  if (!user) {
    const error = new Error("Profile not found");
    error.status = 404;
    throw error;
  }

  let scorecards = await Scorecard.find({ player_id: userId }).sort({ created_at: -1 }).populate("match_id");
  const existingMatchIds = new Set(scorecards.map((scorecard) => scorecard.match_id?._id?.toString?.() || scorecard.match_id?.toString?.()));
  const missingScorecards = matches.filter((match) => !existingMatchIds.has(match._id.toString()));

  if (missingScorecards.length) {
    await Scorecard.insertMany(
      missingScorecards.map((match) => ({
        match_id: match._id,
        player_id: userId,
        runs: match.runs_scored || 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strike_rate: match.strike_rate || 0,
        wickets: match.wickets_taken || 0,
        overs: 0,
        economy: 0,
        catches: 0,
        run_outs: 0,
      })),
      { ordered: false },
    ).catch(() => {});
    scorecards = await Scorecard.find({ player_id: userId }).sort({ created_at: -1 }).populate("match_id");
  }

  const scorecardByMatch = new Map(scorecards.map((scorecard) => [
    scorecard.match_id?._id?.toString?.() || scorecard.match_id?.toString?.(),
    scorecard,
  ]));

  const totalRuns = scorecards.reduce((sum, scorecard) => sum + (scorecard.runs || 0), 0);
  const totalWickets = scorecards.reduce((sum, scorecard) => sum + (scorecard.wickets || 0), 0);
  const totalBalls = scorecards.reduce((sum, scorecard) => sum + (scorecard.balls || 0), 0);
  const battingInnings = scorecards.filter((scorecard) => (scorecard.balls || 0) > 0 || (scorecard.runs || 0) > 0).length;
  const matchesPlayed = matches.length;
  const stats = {
    total_runs: totalRuns,
    total_wickets: totalWickets,
    strike_rate: totalBalls > 0 ? round((totalRuns / totalBalls) * 100) : 0,
    batting_average: battingInnings > 0 ? round(totalRuns / battingInnings) : 0,
    matches_played: matchesPlayed,
    highlights_count: highlights.length,
  };

  return {
    profile: serializeUserProfile(user, stats),
    stats,
    matches: matches.map((match) => serializeMatch(match, scorecardByMatch.get(match._id.toString()))),
    scorecards: scorecards.map((scorecard) => serializeScorecard(scorecard, scorecard.match_id?._id ? scorecard.match_id : null)),
    highlights: highlights.map(serializeHighlight),
  };
};

export const getProfile = async (req, res, next) => {
  try {
    const bundle = await getProfileBundle(req.params.userId);
    bundle.profile.is_self = req.params.userId === req.user._id.toString();
    bundle.profile.is_following = bundle.profile.is_self
      ? false
      : Boolean(await Follow.exists({ follower_id: req.user._id, following_id: req.params.userId }));
    res.json(bundle);
  } catch (error) {
    next(error);
  }
};

export const getProfileMatches = async (req, res, next) => {
  try {
    const { matches } = await getProfileBundle(req.params.userId);
    res.json({ matches });
  } catch (error) {
    next(error);
  }
};

export const getProfileHighlights = async (req, res, next) => {
  try {
    const { highlights } = await getProfileBundle(req.params.userId);
    res.json({ highlights });
  } catch (error) {
    next(error);
  }
};

export const getProfileScorecards = async (req, res, next) => {
  try {
    const { scorecards } = await getProfileBundle(req.params.userId);
    res.json({ scorecards });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const allowed = ["username", "handle", "bio", "location", "player_role", "avatar_url"];
    const update = {};

    allowed.forEach((key) => {
      if (req.body[key] === undefined) return;
      const value = String(req.body[key] || "").trim();
      if (key === "username") update.name = value;
      else if (key === "avatar_url") update.avatar = value;
      else update[key] = key === "handle" ? value.replace(/^@/, "").toLowerCase() || null : value;
    });

    if (update.name !== undefined && update.name.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters" });
    }

    if (update.handle && !/^[a-z0-9_]{3,28}$/.test(update.handle)) {
      return res.status(400).json({ message: "Handle must be 3-28 letters, numbers or underscores" });
    }

    if (update.handle) {
      const existing = await User.findOne({ handle: update.handle, _id: { $ne: req.user._id } });
      if (existing) return res.status(409).json({ message: "Handle is already taken" });
    }

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    const bundle = await getProfileBundle(user._id.toString());
    res.json(bundle);
  } catch (error) {
    next(error);
  }
};
