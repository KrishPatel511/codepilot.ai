import prisma from "../lib/prisma";

// Gemini's API has no "remaining quota" endpoint — Google only exposes per-request
// token counts (usageMetadata). So "limit" here is a self-tracked request count
// compared against a manually configured assumed daily cap, not a live number from Google.
// Adjust DAILY_REQUEST_LIMIT in .env to match your actual AI Studio / Cloud plan.
const ASSUMED_DAILY_REQUEST_LIMIT = Number(process.env.DAILY_REQUEST_LIMIT) || 1500;

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getUsageSummary(userId: number) {
  const since = startOfTodayUTC();

  const [todayAgg, lastLog, perModelToday] = await Promise.all([
    prisma.usageLog.aggregate({
      where: { userId, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
    }),
    prisma.usageLog.findFirst({
      where: { userId },
      orderBy: { id: "desc" },
      select: { model: true },
    }),
    prisma.usageLog.groupBy({
      by: ["model"],
      where: { userId, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalTokens: true },
    }),
  ]);

  const requests = todayAgg._count._all;

  return {
    lastModelUsed: lastLog?.model || null,
    today: {
      requests,
      promptTokens: todayAgg._sum.promptTokens || 0,
      completionTokens: todayAgg._sum.completionTokens || 0,
      totalTokens: todayAgg._sum.totalTokens || 0,
      assumedDailyLimit: ASSUMED_DAILY_REQUEST_LIMIT,
      percentUsed: Math.min(100, Math.round((requests / ASSUMED_DAILY_REQUEST_LIMIT) * 100)),
    },
    perModelToday: perModelToday.map((row) => ({
      model: row.model,
      requests: row._count._all,
      totalTokens: row._sum.totalTokens || 0,
    })),
  };
}
