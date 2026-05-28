import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    message_type: {
      type: String,
      enum: ["text", "image", "video", "audio", "feed", "scorecard", "profile", "match", "highlight"],
      default: "text",
      index: true,
    },
    text: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    media_url: {
      type: String,
      default: "",
    },
    thumbnail_url: {
      type: String,
      default: "",
    },
    shared_ref_type: {
      type: String,
      enum: ["feed", "scorecard", "profile", "match", "highlight", ""],
      default: "",
    },
    shared_ref_id: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "seen", "failed"],
      default: "sent",
      index: true,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

messageSchema.index({ conversation_id: 1, created_at: -1 });

export default mongoose.model("Message", messageSchema);
