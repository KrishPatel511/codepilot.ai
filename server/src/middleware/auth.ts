import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

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

async function loadUser(userId: number): Promise<AuthUser | undefined> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return undefined;

  return {
    id: user.id,
    githubId: user.githubId,
    username: user.username,
    avatarUrl: user.avatarUrl,
    accessToken: user.accessToken,
  };
}

// ---- Attaches req.user if a valid token is present, but never blocks the request ----
export async function attachUser(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
      req.user = await loadUser(payload.userId);
    } catch {
      // invalid/expired token, or lookup failed — leave req.user unset
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
