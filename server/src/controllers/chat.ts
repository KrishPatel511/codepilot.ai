import { Request, Response } from "express";
import { sendMessage } from "../services/chat";

export async function postChat(req: Request, res: Response) {
  try {
    const { chatId, message, thinkMode, regenerate } = req.body as {
      chatId: number;
      message: string;
      thinkMode?: boolean;
      regenerate?: boolean;
    };

    if (!chatId || !message || !message.trim()) {
      return res.status(400).json({ error: "chatId and message are required" });
    }

    const result = await sendMessage(
      req.user!.id,
      req.user!.accessToken,
      chatId,
      message,
      !!thinkMode,
      !!regenerate
    );
    if (!result) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Chat error:", error.message);
    res.status(500).json({ error: "Something went wrong talking to Gemini" });
  }
}
