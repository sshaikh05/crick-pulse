import fs from "node:fs/promises";
import Match from "../models/Match.js";
import Scorecard from "../models/Scorecard.js";

const publicMatchFields = "name email avatar";

const getBaseUrl = (req) => `${req.protocol}://${req.get("host")}`;

const serializeMatch = (match) => ({
  id: match._id.toString(),
  user_id: match.user_id?._id?.toString?.() || match.user_id?.toString?.() || "",
  match_name: match.match_name,
  location: match.location || "",
  team_a: match.team_a || "",
  team_b: match.team_b || "",
  video_url: match.video_url,
  video_file_name: match.video_file_name || "",
  video_size: match.video_size || 0,
  thumbnail_url: match.thumbnail_url || "",
  match_result: match.match_result || "",
  runs_scored: match.runs_scored || 0,
  wickets_taken: match.wickets_taken || 0,
  strike_rate: match.strike_rate || 0,
  status: match.status,
  created_at: match.created_at,
  updated_at: match.updated_at,
  user: match.user_id?.name
    ? {
        id: match.user_id._id.toString(),
        name: match.user_id.name,
        email: match.user_id.email,
        avatar: match.user_id.avatar,
      }
    : null,
});

export const createMatch = async (req, res, next) => {
  try {
    const { match_name, location = "", team_a = "", team_b = "" } = req.body;
    const trimmedName = match_name?.trim();

    if (!trimmedName) {
      if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ message: "Match name is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Video file is required" });
    }

    const videoUrl = `${getBaseUrl(req)}/uploads/matches/${req.file.filename}`;
    const match = await Match.create({
      user_id: req.user._id,
      match_name: trimmedName,
      location: location.trim(),
      team_a: team_a.trim(),
      team_b: team_b.trim(),
      video_url: videoUrl,
      video_file_name: req.file.originalname,
      video_size: req.file.size,
      thumbnail_url: "",
      status: "active",
    });

    await match.populate("user_id", publicMatchFields);
    await Scorecard.create({
      match_id: match._id,
      player_id: req.user._id,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      strike_rate: 0,
      wickets: 0,
      overs: 0,
      economy: 0,
      catches: 0,
      run_outs: 0,
    }).catch(() => {});

    res.status(201).json({ match: serializeMatch(match) });
  } catch (error) {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    next(error);
  }
};

export const getMatches = async (_req, res, next) => {
  try {
    const matches = await Match.find({ status: { $in: ["active", "published"] } })
      .sort({ created_at: -1 })
      .limit(50)
      .populate("user_id", publicMatchFields);

    res.json({ matches: matches.map(serializeMatch) });
  } catch (error) {
    next(error);
  }
};

export const getMatch = async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id).populate("user_id", publicMatchFields);

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    res.json({ match: serializeMatch(match) });
  } catch (error) {
    next(error);
  }
};
