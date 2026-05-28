import { Router } from "express";
import {
  getProfile,
  getProfileHighlights,
  getProfileMatches,
  getProfileScorecards,
  updateProfile,
} from "../controllers/profileController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/:userId", protect, getProfile);
router.get("/:userId/matches", protect, getProfileMatches);
router.get("/:userId/highlights", protect, getProfileHighlights);
router.get("/:userId/scorecards", protect, getProfileScorecards);
router.patch("/", protect, updateProfile);

export default router;
