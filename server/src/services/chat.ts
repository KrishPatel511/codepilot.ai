import prisma from "../lib/prisma";
import { askGemini, ChatMessage } from "./gemini";

export interface SendMessageResult {
  reply: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

// ---- Persists the user's message, asks Gemini, persists the reply + usage log ----
// Returns null if the chat doesn't exist or isn't owned by this user.
export async function sendMessage(
  userId: number,
  accessToken: string,
  chatId: number,
  message: string,
  thinkMode: boolean
): Promise<SendMessageResult | null> {
  const chat = await prisma.chat.findFirst({ where: { id: chatId, userId } });
  if (!chat) return null;

  await prisma.message.create({ data: { chatId, role: "user", text: message } });

  const isFirstMessage = chat.title === "New chat";
  if (isFirstMessage) {
    await prisma.chat.update({ where: { id: chatId }, data: { title: message.slice(0, 40) } });
  }

  const rows = await prisma.message.findMany({ where: { chatId }, orderBy: { id: "asc" } });
  const history: ChatMessage[] = rows.map((m) => ({
    role: m.role === "agent" ? "model" : "user",
    text: m.text,
  }));

  const priorContext = chat.lastContext ? JSON.parse(chat.lastContext) : null;
  const result = await askGemini(history, accessToken, { thinkMode, priorContext });

  await prisma.message.create({ data: { chatId, role: "agent", text: result.text } });
  await prisma.usageLog.create({
    data: {
      userId,
      model: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
    },
  });
  await prisma.chat.update({
    where: { id: chatId },
    data: { lastContext: result.lastToolContext ? JSON.stringify(result.lastToolContext) : null },
  });

  return { reply: result.text, model: result.model, usage: result.usage };
}
