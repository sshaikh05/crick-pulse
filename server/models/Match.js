import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    match_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    location: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    team_a: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    team_b: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    video_url: {
      type: String,
      required: true,
    },
    video_file_name: {
      type: String,
      default: "",
    },
    video_size: {
      type: Number,
      default: 0,
    },
    thumbnail_url: {
      type: String,
      default: "",
    },
    match_result: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    runs_scored: {
      type: Number,
      default: 0,
      min: 0,
    },
    wickets_taken: {
      type: Number,
      default: 0,
      min: 0,
    },
    strike_rate: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "published", "archived"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

export default mongoose.model("Match", matchSchema);
