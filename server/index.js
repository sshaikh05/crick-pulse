import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import highlightRoutes from "./routes/highlightRoutes.js";
import leaderboardRoutes from "./routes/leaderboardRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import userRoutes from "./routes/userRoutes.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:8080", credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "crickpulse-api" });
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/auth", authRoutes);
app.use("/api", chatRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/highlights", highlightRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/users", userRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
