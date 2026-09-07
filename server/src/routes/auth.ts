import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { redirectToGithub, handleGithubCallback, getMe } from "../controllers/auth";

const router = Router();

router.get("/github", redirectToGithub);
router.get("/github/callback", handleGithubCallback);
router.get("/me", requireAuth, getMe);

export default router;
