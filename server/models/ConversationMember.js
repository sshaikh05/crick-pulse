import mongoose from "mongoose";

const conversationMemberSchema = new mongoose.Schema(
  {
    conversation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["owner", "member"],
      default: "member",
    },
    joined_at: {
      type: Date,
      default: Date.now,
    },
    last_read_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: false },
);

conversationMemberSchema.index({ conversation_id: 1, user_id: 1 }, { unique: true });

export default mongoose.model("ConversationMember", conversationMemberSchema);
