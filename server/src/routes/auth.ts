import { Router, Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const CALLBACK_URL = `http://localhost:${process.env.PORT || 5001}/auth/github/callback`;

// ---- Step 1: send the browser to GitHub's own login/consent page ----
router.get("/github", (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, { httpOnly: true, maxAge: 5 * 60 * 1000, sameSite: "lax" });

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    scope: "repo",
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// ---- Step 2: GitHub redirects back here with a one-time `code` ----
router.get("/github/callback", async (req: Request, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string };

  if (!code || !state || state !== req.cookies?.oauth_state) {
    return res.status(400).send("Invalid OAuth state. Please try logging in again.");
  }
  res.clearCookie("oauth_state");

  try {
    // Exchange the one-time code for a real GitHub access token, for THIS user only.
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: CALLBACK_URL },
      { headers: { Accept: "application/json" } }
    );

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      console.error("GitHub token exchange failed:", tokenRes.data);
      return res.status(400).send("GitHub did not return an access token.");
    }

    const profileRes = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    const profile = profileRes.data;

    const existing = db.prepare("SELECT id FROM users WHERE github_id = ?").get(profile.id) as
      | { id: number }
      | undefined;

    let userId: number;
    if (existing) {
      db.prepare("UPDATE users SET username = ?, avatar_url = ?, access_token = ? WHERE id = ?").run(
        profile.login,
        profile.avatar_url,
        accessToken,
        existing.id
      );
      userId = existing.id;
    } else {
      const result = db
        .prepare("INSERT INTO users (github_id, username, avatar_url, access_token) VALUES (?, ?, ?, ?)")
        .run(profile.id, profile.login, profile.avatar_url, accessToken);
      userId = result.lastInsertRowid as number;

      // One-time migration: claim any chats created before auth existed (dev/testing data)
      // so they don't silently disappear the first time someone logs in.
      db.prepare("UPDATE chats SET user_id = ? WHERE user_id IS NULL").run(userId);
    }

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
    res.redirect(`${CLIENT_URL}/?token=${token}`);
  } catch (error: any) {
    console.error("GitHub OAuth error:", error.response?.data || error.message);
    res.status(500).send("Something went wrong logging in with GitHub.");
  }
});

// ---- Returns the currently logged-in user's profile ----
router.get("/me", requireAuth, (req: Request, res: Response) => {
  const { id, username, avatarUrl } = req.user!;
  res.json({ id, username, avatarUrl });
});

export default router;
