import mongoose from "mongoose";

const messageReactionSchema = new mongoose.Schema(
  {
    message_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reaction: {
      type: String,
      required: true,
      trim: true,
      maxlength: 16,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } },
);

messageReactionSchema.index({ message_id: 1, user_id: 1, reaction: 1 }, { unique: true });

export default mongoose.model("MessageReaction", messageReactionSchema);
