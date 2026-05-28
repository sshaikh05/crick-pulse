import { Router } from "express";
import {
  exportHighlight,
  generateHighlight,
  getHighlight,
  trackHighlightShare,
} from "../controllers/highlightController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/generate", protect, generateHighlight);
router.post("/export", protect, exportHighlight);
router.post("/share", protect, trackHighlightShare);
router.get("/:id", protect, getHighlight);

export default router;
