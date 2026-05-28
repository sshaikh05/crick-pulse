import Scorecard from "../models/Scorecard.js";

const validPeriods = new Set(["week", "month", "all"]);
const validTypes = new Set(["runs", "wickets"]);

const getDateFilter = (period) => {
  if (period === "all") return {};
  const now = new Date();
  const start = new Date(now);
  if (period === "week") start.setDate(now.getDate() - 7);
  if (period === "month") start.setMonth(now.getMonth() - 1);
  return { created_at: { $gte: start } };
};

export const getLeaderboard = async (req, res, next) => {
  try {
    const period = validPeriods.has(req.query.period) ? req.query.period : "week";
    const type = validTypes.has(req.query.type) ? req.query.type : "runs";
    const metricField = type === "wickets" ? "total_wickets" : "total_runs";

    const rows = await Scorecard.aggregate([
      { $match: getDateFilter(period) },
      {
        $group: {
          _id: "$player_id",
          total_runs: { $sum: { $ifNull: ["$runs", 0] } },
          total_wickets: { $sum: { $ifNull: ["$wickets", 0] } },
          matches_played: { $addToSet: "$match_id" },
          latest_performance_at: { $max: "$created_at" },
        },
      },
      {
        $addFields: {
          matches_played: { $size: "$matches_played" },
        },
      },
      {
        $match: {
          [metricField]: { $gt: 0 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $sort: {
          [metricField]: -1,
          matches_played: -1,
          latest_performance_at: -1,
        },
      },
      { $limit: 50 },
      {
        $project: {
          _id: 0,
          user_id: { $toString: "$_id" },
          display_name: "$user.name",
          handle: "$user.handle",
          avatar_url: "$user.avatar",
          player_role: "$user.player_role",
          location: "$user.location",
          verified: "$user.is_verified",
          runs: "$total_runs",
          wickets: "$total_wickets",
          matches: "$matches_played",
          latest_performance_at: 1,
        },
      },
    ]);

    res.json({ period, type, players: rows });
  } catch (error) {
    next(error);
  }
};
