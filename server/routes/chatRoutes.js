import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";
import {
  createOrOpenConversation,
  getConversations,
  getMessages,
  markMessageRead,
  searchChatUsers,
  sendMessage,
  toggleMessageReaction,
  uploadMessageMedia,
} from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, "../uploads/messages");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^(image|video|audio)\//.test(file.mimetype)) cb(null, true);
    else cb(new Error("Upload an image, video, or audio file"));
  },
});

const router = Router();

router.get("/conversations", protect, getConversations);
router.post("/conversations", protect, createOrOpenConversation);
router.get("/users", protect, searchChatUsers);
router.get("/messages/:conversationId", protect, getMessages);
router.post("/messages", protect, sendMessage);
router.post("/messages/upload", protect, upload.single("media"), uploadMessageMedia);
router.patch("/messages/:id/read", protect, markMessageRead);
router.post("/messages/:id/reaction", protect, toggleMessageReaction);

export default router;
