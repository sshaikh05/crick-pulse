import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    googleId: {
      type: String,
      sparse: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    handle: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      default: null,
      maxlength: 40,
    },
    bio: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },
    location: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    player_role: {
      type: String,
      trim: true,
      default: "All-Rounder",
      maxlength: 40,
    },
    followers_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    following_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    is_verified: {
      type: Boolean,
      default: true,
    },
    authProvider: {
      type: String,
      enum: ["manual", "google"],
      default: "manual",
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
