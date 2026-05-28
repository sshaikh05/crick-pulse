import mongoose from "mongoose";

const highlightSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    match_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true,
      index: true,
    },
    video_url: {
      type: String,
      required: true,
    },
    thumbnail_url: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      trim: true,
      default: "Match highlight",
      maxlength: 120,
    },
    caption: {
      type: String,
      trim: true,
      default: "",
      maxlength: 280,
    },
    format_exports: {
      type: Map,
      of: String,
      default: {},
    },
    instagram_shares: {
      type: Number,
      default: 0,
      min: 0,
    },
    whatsapp_shares: {
      type: Number,
      default: 0,
      min: 0,
    },
    downloads: {
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

export default mongoose.model("Highlight", highlightSchema);
