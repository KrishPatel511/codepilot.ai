import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import db from "../db";

const router = Router();

router.use(requireAuth);

// ---- List this user's chats (pinned first, then most recently created) ----
router.get("/", (req: Request, res: Response) => {
  const chats = db
    .prepare("SELECT id, title, pinned, created_at FROM chats WHERE user_id = ? ORDER BY pinned DESC, id DESC")
    .all(req.user!.id);
  res.json(chats);
});

// ---- Get one of this user's chats with its full message history ----
router.get("/:id", (req: Request, res: Response) => {
  const chat = db
    .prepare("SELECT id, title, pinned, created_at FROM chats WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user!.id);
  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }
  const messages = db
    .prepare("SELECT id, role, text, created_at FROM messages WHERE chat_id = ? ORDER BY id ASC")
    .all(req.params.id);
  res.json({ ...chat, messages });
});

// ---- Create a new empty chat for this user ----
router.post("/", (req: Request, res: Response) => {
  const title = (req.body?.title as string) || "New chat";
  const result = db.prepare("INSERT INTO chats (user_id, title) VALUES (?, ?)").run(req.user!.id, title);
  const chat = db
    .prepare("SELECT id, title, pinned, created_at FROM chats WHERE id = ?")
    .get(result.lastInsertRowid);
  res.status(201).json(chat);
});

// ---- Rename and/or pin/unpin one of this user's chats ----
router.patch("/:id", (req: Request, res: Response) => {
  const { title, pinned } = req.body as { title?: string; pinned?: boolean };

  if (title === undefined && pinned === undefined) {
    return res.status(400).json({ error: "title or pinned is required" });
  }

  const owned = db.prepare("SELECT id FROM chats WHERE id = ? AND user_id = ?").get(
    req.params.id,
    req.user!.id
  );
  if (!owned) {
    return res.status(404).json({ error: "Chat not found" });
  }

  if (title !== undefined) {
    db.prepare("UPDATE chats SET title = ? WHERE id = ?").run(title, req.params.id);
  }
  if (pinned !== undefined) {
    db.prepare("UPDATE chats SET pinned = ? WHERE id = ?").run(pinned ? 1 : 0, req.params.id);
  }

  const chat = db.prepare("SELECT id, title, pinned, created_at FROM chats WHERE id = ?").get(req.params.id);
  res.json(chat);
});

// ---- Delete one of this user's chats (its messages cascade-delete) ----
router.delete("/:id", (req: Request, res: Response) => {
  const result = db.prepare("DELETE FROM chats WHERE id = ? AND user_id = ?").run(req.params.id, req.user!.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Chat not found" });
  }
  res.status(204).end();
});

export default router;
