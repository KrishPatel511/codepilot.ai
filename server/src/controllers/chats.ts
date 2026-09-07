import { Request, Response } from "express";
import * as chatsService from "../services/chats";

// ---- List this user's chats (pinned first, then most recently created) ----
export async function getChats(req: Request, res: Response) {
  const chats = await chatsService.listChats(req.user!.id);
  res.json(chats);
}

// ---- Get one of this user's chats with its full message history ----
export async function getChat(req: Request, res: Response) {
  const chat = await chatsService.getChatWithMessages(Number(req.params.id), req.user!.id);
  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }
  res.json(chat);
}

// ---- Create a new empty chat for this user ----
export async function postChatSession(req: Request, res: Response) {
  const title = (req.body?.title as string) || "New chat";
  const chat = await chatsService.createChat(req.user!.id, title);
  res.status(201).json(chat);
}

// ---- Rename and/or pin/unpin one of this user's chats ----
export async function patchChat(req: Request, res: Response) {
  const { title, pinned } = req.body as { title?: string; pinned?: boolean };

  if (title === undefined && pinned === undefined) {
    return res.status(400).json({ error: "title or pinned is required" });
  }

  const chat = await chatsService.updateChat(Number(req.params.id), req.user!.id, { title, pinned });
  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }
  res.json(chat);
}

// ---- Delete one of this user's chats (its messages cascade-delete) ----
export async function deleteChatSession(req: Request, res: Response) {
  const deleted = await chatsService.deleteChat(Number(req.params.id), req.user!.id);
  if (!deleted) {
    return res.status(404).json({ error: "Chat not found" });
  }
  res.status(204).end();
}
