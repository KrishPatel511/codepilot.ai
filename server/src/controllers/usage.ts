import { Request, Response } from "express";
import { getUsageSummary } from "../services/usage";

export async function getUsage(req: Request, res: Response) {
  const summary = await getUsageSummary(req.user!.id);
  res.json(summary);
}
