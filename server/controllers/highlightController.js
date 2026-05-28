import Match from "../models/Match.js";
import Highlight from "../models/Highlight.js";
import Scorecard from "../models/Scorecard.js";

const VALID_FORMATS = new Set(["reels", "post", "wide"]);
const VALID_CHANNELS = new Set(["instagram", "whatsapp", "download", "copy_link"]);

const publicMatchFields = "name email avatar handle";

const serializeScorecard = (scorecard) => ({
  id: scorecard?._id?.toString?.() || "",
  runs: scorecard?.runs || 0,
  balls: scorecard?.balls || 0,
  fours: scorecard?.fours || 0,
  sixes: scorecard?.sixes || 0,
  strike_rate: scorecard?.strike_rate || 0,
  wickets: scorecard?.wickets || 0,
  overs: scorecard?.overs || 0,
  economy: scorecard?.economy || 0,
  catches: scorecard?.catches || 0,
  run_outs: scorecard?.run_outs || 0,
});

const serializeHighlight = (highlight, match, scorecard) => ({
  id: highlight._id.toString(),
  user_id: highlight.user_id?.toString?.() || "",
  match_id: highlight.match_id?._id?.toString?.() || highlight.match_id?.toString?.() || "",
  video_url: highlight.video_url,
  thumbnail_url: highlight.thumbnail_url || "",
  title: highlight.title,
  caption: highlight.caption || "",
  created_at: highlight.created_at,
  analytics: {
    instagram_shares: highlight.instagram_shares || 0,
    whatsapp_shares: highlight.whatsapp_shares || 0,
    downloads: highlight.downloads || 0,
  },
  match: match
    ? {
        id: match._id.toString(),
        match_name: match.match_name,
        team_a: match.team_a || "",
        team_b: match.team_b || "",
        location: match.location || "",
        video_url: match.video_url || "",
        thumbnail_url: match.thumbnail_url || "",
        match_result: match.match_result || "",
        created_at: match.created_at,
        user: match.user_id?.name
          ? {
              id: match.user_id._id.toString(),
              name: match.user_id.name,
              avatar: match.user_id.avatar,
              handle: match.user_id.handle,
            }
          : null,
      }
    : null,
  scorecard: serializeScorecard(scorecard),
});

const getHighlightBundle = async (highlightId) => {
  const highlight = await Highlight.findById(highlightId);
  if (!highlight) {
    const error = new Error("Highlight not found");
    error.status = 404;
    throw error;
  }

  const [match, scorecard] = await Promise.all([
    Match.findById(highlight.match_id).populate("user_id", publicMatchFields),
    Scorecard.findOne({ match_id: highlight.match_id, player_id: highlight.user_id }),
  ]);

  return serializeHighlight(highlight, match, scorecard);
};

export const generateHighlight = async (req, res, next) => {
  try {
    const { match_id, caption = "" } = req.body;
    const match = await Match.findOne({ _id: match_id, user_id: req.user._id }).populate("user_id", publicMatchFields);

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const scorecard = await Scorecard.findOneAndUpdate(
      { match_id: match._id, player_id: req.user._id },
      {
        $setOnInsert: {
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
        },
      },
      { new: true, upsert: true },
    );

    const highlight = await Highlight.findOneAndUpdate(
      { match_id: match._id, user_id: req.user._id },
      {
        $setOnInsert: {
          video_url: match.video_url,
          thumbnail_url: match.thumbnail_url || "",
          title: match.match_name,
        },
        ...(caption ? { caption: String(caption).slice(0, 280) } : {}),
      },
      { new: true, upsert: true },
    );

    res.status(201).json({ highlight: serializeHighlight(highlight, match, scorecard) });
  } catch (error) {
    next(error);
  }
};

export const getHighlight = async (req, res, next) => {
  try {
    const highlight = await getHighlightBundle(req.params.id);
    res.json({ highlight });
  } catch (error) {
    next(error);
  }
};

export const exportHighlight = async (req, res, next) => {
  try {
    const { highlight_id, format = "reels", caption = "", watermark = true } = req.body;
    const selectedFormat = VALID_FORMATS.has(format) ? format : "reels";
    const highlight = await Highlight.findOne({ _id: highlight_id, user_id: req.user._id });

    if (!highlight) {
      return res.status(404).json({ message: "Highlight not found" });
    }

    if (caption) highlight.caption = String(caption).slice(0, 280);
    highlight.format_exports.set(`${selectedFormat}:${watermark ? "wm" : "clean"}`, highlight.video_url);
    await highlight.save();

    res.json({
      export: {
        highlight_id: highlight._id.toString(),
        format: selectedFormat,
        watermark: Boolean(watermark),
        video_url: highlight.video_url,
        caption: highlight.caption || "",
        filename: `CrickPulse_Highlight_${selectedFormat}_${new Date().getFullYear()}.mp4`,
        cached: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const trackHighlightShare = async (req, res, next) => {
  try {
    const { highlight_id, channel } = req.body;
    const selectedChannel = VALID_CHANNELS.has(channel) ? channel : "copy_link";
    const field = selectedChannel === "instagram"
      ? "instagram_shares"
      : selectedChannel === "whatsapp"
        ? "whatsapp_shares"
        : selectedChannel === "download"
          ? "downloads"
          : null;

    const update = field ? { $inc: { [field]: 1 } } : {};
    const highlight = await Highlight.findOneAndUpdate(
      { _id: highlight_id, user_id: req.user._id },
      update,
      { new: true },
    );

    if (!highlight) {
      return res.status(404).json({ message: "Highlight not found" });
    }

    res.json({ ok: true, analytics: {
      instagram_shares: highlight.instagram_shares || 0,
      whatsapp_shares: highlight.whatsapp_shares || 0,
      downloads: highlight.downloads || 0,
    } });
  } catch (error) {
    next(error);
  }
};
