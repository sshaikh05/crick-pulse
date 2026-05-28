import mongoose from "mongoose";

const scorecardSchema = new mongoose.Schema(
  {
    match_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true,
      index: true,
    },
    player_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    runs: {
      type: Number,
      default: 0,
      min: 0,
    },
    balls: {
      type: Number,
      default: 0,
      min: 0,
    },
    fours: {
      type: Number,
      default: 0,
      min: 0,
    },
    sixes: {
      type: Number,
      default: 0,
      min: 0,
    },
    strike_rate: {
      type: Number,
      default: 0,
      min: 0,
    },
    wickets: {
      type: Number,
      default: 0,
      min: 0,
    },
    overs: {
      type: Number,
      default: 0,
      min: 0,
    },
    economy: {
      type: Number,
      default: 0,
      min: 0,
    },
    catches: {
      type: Number,
      default: 0,
      min: 0,
    },
    run_outs: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

scorecardSchema.index({ match_id: 1, player_id: 1 }, { unique: true });

export default mongoose.model("Scorecard", scorecardSchema);
