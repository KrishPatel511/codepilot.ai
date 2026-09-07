import prisma from "../lib/prisma";

// Matches the "YYYY-MM-DD HH:MM:SS" (UTC) format the frontend expects from
// message timestamps, so switching DBs doesn't change the wire format it parses.
function toWireTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function listChats(userId: number) {
  return prisma.chat.findMany({
    where: { userId },
    select: { id: true, title: true, pinned: true, createdAt: true },
    orderBy: [{ pinned: "desc" }, { id: "desc" }],
  });
}

export async function getChatWithMessages(chatId: number, userId: number) {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    select: { id: true, title: true, pinned: true, createdAt: true },
  });
  if (!chat) return null;

  const messages = await prisma.message.findMany({
    where: { chatId },
    orderBy: { id: "asc" },
  });

  return {
    ...chat,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      created_at: toWireTimestamp(m.createdAt),
    })),
  };
}

export function createChat(userId: number, title: string) {
  return prisma.chat.create({
    data: { userId, title },
    select: { id: true, title: true, pinned: true, createdAt: true },
  });
}

export async function updateChat(
  chatId: number,
  userId: number,
  data: { title?: string; pinned?: boolean }
) {
  const owned = await prisma.chat.findFirst({ where: { id: chatId, userId } });
  if (!owned) return null;

  return prisma.chat.update({
    where: { id: chatId },
    data,
    select: { id: true, title: true, pinned: true, createdAt: true },
  });
}

export async function deleteChat(chatId: number, userId: number): Promise<boolean> {
  const result = await prisma.chat.deleteMany({ where: { id: chatId, userId } });
  return result.count > 0;
}
