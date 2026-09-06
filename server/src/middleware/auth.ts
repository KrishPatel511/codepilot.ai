import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import db from "../db";

const JWT_SECRET = process.env.JWT_SECRET || "";

export interface AuthUser {
  id: number;
  githubId: number;
  username: string;
  avatarUrl: string | null;
  accessToken: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function loadUser(userId: number): AuthUser | undefined {
  const row = db
    .prepare("SELECT id, github_id, username, avatar_url, access_token FROM users WHERE id = ?")
    .get(userId) as
    | { id: number; github_id: number; username: string; avatar_url: string | null; access_token: string }
    | undefined;

  if (!row) return undefined;

  return {
    id: row.id,
    githubId: row.github_id,
    username: row.username,
    avatarUrl: row.avatar_url,
    accessToken: row.access_token,
  };
}

// ---- Attaches req.user if a valid token is present, but never blocks the request ----
export function attachUser(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
      req.user = loadUser(payload.userId);
    } catch {
      // invalid/expired token — leave req.user unset
    }
  }

  next();
}

// ---- Blocks the request unless attachUser found a valid, logged-in user ----
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
}
