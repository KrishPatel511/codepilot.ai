import { Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { upsertGithubUser } from "../services/auth";

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
// In production, set SERVER_URL to this backend's public URL (e.g. https://your-app.onrender.com)
// so GitHub redirects back to the right place instead of localhost.
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5001}`;
const CALLBACK_URL = `${SERVER_URL}/auth/github/callback`;

// ---- Step 1: send the browser to GitHub's own login/consent page ----
export function redirectToGithub(req: Request, res: Response) {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, { httpOnly: true, maxAge: 5 * 60 * 1000, sameSite: "lax" });

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    scope: "repo",
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

// ---- Step 2: GitHub redirects back here with a one-time `code` ----
export async function handleGithubCallback(req: Request, res: Response) {
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

    const user = await upsertGithubUser(profileRes.data, accessToken);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
    res.redirect(`${CLIENT_URL}/?token=${token}`);
  } catch (error: any) {
    console.error("GitHub OAuth error:", error.response?.data || error.message);
    res.status(500).send("Something went wrong logging in with GitHub.");
  }
}

// ---- Returns the currently logged-in user's profile ----
export function getMe(req: Request, res: Response) {
  const { id, username, avatarUrl } = req.user!;
  res.json({ id, username, avatarUrl });
}
