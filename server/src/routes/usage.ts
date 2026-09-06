import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import db from "../db";

const router = Router();
router.use(requireAuth);

// Gemini's API has no "remaining quota" endpoint — Google only exposes per-request
// token counts (usageMetadata). So "limit" here is a self-tracked request count
// compared against a manually configured assumed daily cap, not a live number from Google.
// Adjust DAILY_REQUEST_LIMIT in .env to match your actual AI Studio / Cloud plan.
const ASSUMED_DAILY_REQUEST_LIMIT = Number(process.env.DAILY_REQUEST_LIMIT) || 1500;

interface TodayTotals {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

router.get("/", (req: Request, res: Response) => {
  const userId = req.user!.id;

  const today = db
    .prepare(
      `SELECT COUNT(*) as requests,
              COALESCE(SUM(prompt_tokens), 0) as promptTokens,
              COALESCE(SUM(completion_tokens), 0) as completionTokens,
              COALESCE(SUM(total_tokens), 0) as totalTokens
       FROM usage_logs
       WHERE user_id = ? AND date(created_at) = date('now')`
    )
    .get(userId) as TodayTotals;

  const lastLog = db
    .prepare("SELECT model, created_at FROM usage_logs WHERE user_id = ? ORDER BY id DESC LIMIT 1")
    .get(userId) as { model: string; created_at: string } | undefined;

  const perModelToday = db
    .prepare(
      `SELECT model, COUNT(*) as requests, COALESCE(SUM(total_tokens), 0) as totalTokens
       FROM usage_logs
       WHERE user_id = ? AND date(created_at) = date('now')
       GROUP BY model`
    )
    .all(userId) as { model: string; requests: number; totalTokens: number }[];

  res.json({
    lastModelUsed: lastLog?.model || null,
    today: {
      requests: today.requests,
      promptTokens: today.promptTokens,
      completionTokens: today.completionTokens,
      totalTokens: today.totalTokens,
      assumedDailyLimit: ASSUMED_DAILY_REQUEST_LIMIT,
      percentUsed: Math.min(100, Math.round((today.requests / ASSUMED_DAILY_REQUEST_LIMIT) * 100)),
    },
    perModelToday,
  });
});

export default router;
