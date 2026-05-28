import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    match_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      index: true,
      default: null,
    },
    highlight_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Highlight",
      index: true,
      default: null,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 280,
    },
    liked_by: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    likes_count: {
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

commentSchema.index({ match_id: 1, created_at: -1 });
commentSchema.index({ highlight_id: 1, created_at: -1 });

export default mongoose.model("Comment", commentSchema);
