import { Router } from "express";
import {
  followUser,
  getFollowers,
  getFollowing,
  searchUsers,
  unfollowUser,
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/search", protect, searchUsers);
router.post("/:id/follow", protect, followUser);
router.delete("/:id/follow", protect, unfollowUser);
router.get("/:id/followers", protect, getFollowers);
router.get("/:id/following", protect, getFollowing);

export default router;
