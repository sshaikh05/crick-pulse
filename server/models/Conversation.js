import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
      index: true,
    },
    last_message: {
      type: String,
      default: "",
    },
    last_message_type: {
      type: String,
      default: "text",
    },
    last_message_at: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

export default mongoose.model("Conversation", conversationSchema);
