import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getChats, getChat, postChatSession, patchChat, deleteChatSession } from "../controllers/chats";

const router = Router();
router.use(requireAuth);

router.get("/", getChats);
router.get("/:id", getChat);
router.post("/", postChatSession);
router.patch("/:id", patchChat);
router.delete("/:id", deleteChatSession);

export default router;
