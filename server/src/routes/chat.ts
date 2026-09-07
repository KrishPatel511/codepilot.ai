import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { postChat } from "../controllers/chat";

const router = Router();

router.post("/", requireAuth, postChat);

export default router;
