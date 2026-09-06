import { Router, Request, Response } from "express";
import { askGemini, ChatMessage } from "../services/gemini";
import { requireAuth } from "../middleware/auth";
import db from "../db";

const router = Router();

router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { chatId, message, thinkMode } = req.body as { chatId: number; message: string; thinkMode?: boolean };

    if (!chatId || !message || !message.trim()) {
      return res.status(400).json({ error: "chatId and message are required" });
    }

    const chat = db.prepare("SELECT id, title, last_context FROM chats WHERE id = ? AND user_id = ?").get(
      chatId,
      req.user!.id
    ) as { id: number; title: string; last_context: string | null } | undefined;
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    db.prepare("INSERT INTO messages (chat_id, role, text) VALUES (?, 'user', ?)").run(chatId, message);

    const isFirstMessage = chat.title === "New chat";
    if (isFirstMessage) {
      db.prepare("UPDATE chats SET title = ? WHERE id = ?").run(message.slice(0, 40), chatId);
    }

    const rows = db
      .prepare("SELECT role, text FROM messages WHERE chat_id = ? ORDER BY id ASC")
      .all(chatId) as { role: "user" | "agent"; text: string }[];

    const history: ChatMessage[] = rows.map((m) => ({
      role: m.role === "agent" ? "model" : "user",
      text: m.text,
    }));

    const priorContext = chat.last_context ? JSON.parse(chat.last_context) : null;
    const result = await askGemini(history, req.user!.accessToken, { thinkMode: !!thinkMode, priorContext });

    db.prepare("INSERT INTO messages (chat_id, role, text) VALUES (?, 'agent', ?)").run(chatId, result.text);
    db.prepare(
      "INSERT INTO usage_logs (user_id, model, prompt_tokens, completion_tokens, total_tokens) VALUES (?, ?, ?, ?, ?)"
    ).run(
      req.user!.id,
      result.model,
      result.usage.promptTokens,
      result.usage.completionTokens,
      result.usage.totalTokens
    );
    db.prepare("UPDATE chats SET last_context = ? WHERE id = ?").run(
      result.lastToolContext ? JSON.stringify(result.lastToolContext) : null,
      chatId
    );

    res.json({ reply: result.text, model: result.model, usage: result.usage });
  } catch (error: any) {
    console.error("Chat error:", error.message);
    res.status(500).json({ error: "Something went wrong talking to Gemini" });
  }
});

export default router;
