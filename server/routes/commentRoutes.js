import { Router } from "express";
import {
  createComment,
  deleteComment,
  getComments,
  toggleCommentLike,
} from "../controllers/commentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", getComments);
router.post("/", protect, createComment);
router.patch("/:id/like", protect, toggleCommentLike);
router.delete("/:id", protect, deleteComment);

export default router;
