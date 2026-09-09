import prisma from "../lib/prisma";
import { askGemini, ChatMessage, GeminiResult } from "./gemini";
import { getFullRepoTree, listRepos } from "./github";

export interface SendMessageResult {
  reply: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

const FULL_TREE_REQUEST =
  /\b(full|complete|entire|all)\b.*\b(folder|folders|file|files|tree|structure)\b|\b(folder|folders|file|files|tree|structure)\b.*\b(full|complete|entire|all)\b/i;
const NON_TREE_WORK = /\b(read|analy[sz]e|review|explain|fix|search|find|compare|summari[sz]e)\b/i;

function repositoryFromTreeRequest(message: string): { owner?: string; repo: string } | null {
  if (!FULL_TREE_REQUEST.test(message) || NON_TREE_WORK.test(message)) return null;

  const fullName = message.match(/\b([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\b/);
  if (fullName) return { owner: fullName[1], repo: fullName[2] };

  const namedRepository = message.match(/\b(?:of|for|in)\s+(?:the\s+)?["']?([A-Za-z0-9_.-]+)["']?\s+(?:repo|repository)\b/i);
  return namedRepository ? { repo: namedRepository[1] } : null;
}

/**
 * A folder-tree request does not need LLM reasoning. Returning it directly
 * saves two slow model calls: deciding to call the tool, then reformatting the
 * same tree for the user.
 */
async function getDirectTreeReply(message: string, accessToken: string): Promise<GeminiResult | null> {
  const requested = repositoryFromTreeRequest(message);
  if (!requested) return null;

  let fullName = requested.owner ? `${requested.owner}/${requested.repo}` : "";

  if (!fullName) {
    const repositories = await listRepos(accessToken);
    const matched = repositories.find(
      (item: { name: string; fullName: string }) => item.name.toLowerCase() === requested.repo.toLowerCase()
    );
    if (!matched) return null;
    fullName = matched.fullName;
  }

  const [owner, repo] = fullName.split("/", 2);
  const tree = await getFullRepoTree(accessToken, owner, repo, undefined, Number.POSITIVE_INFINITY);
  return {
    text: `\`\`\`text\n${tree.treeText}\n\`\`\``,
    model: "direct-github-tree",
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    lastToolContext: null,
  };
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
  const result = (await getDirectTreeReply(message, accessToken)) ??
    (await askGemini(history, accessToken, { thinkMode, priorContext }));

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
