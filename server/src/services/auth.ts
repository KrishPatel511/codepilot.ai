import prisma from "../lib/prisma";

export interface GithubProfile {
  id: number;
  login: string;
  avatar_url: string;
}

// ---- Creates a new user or refreshes an existing one's profile/token from GitHub ----
export async function upsertGithubUser(profile: GithubProfile, accessToken: string) {
  const existing = await prisma.user.findUnique({ where: { githubId: profile.id } });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { username: profile.login, avatarUrl: profile.avatar_url, accessToken },
    });
  }

  const user = await prisma.user.create({
    data: {
      githubId: profile.id,
      username: profile.login,
      avatarUrl: profile.avatar_url,
      accessToken,
    },
  });

  // One-time migration: claim any chats created before auth existed (dev/testing data)
  // so they don't silently disappear the first time someone logs in.
  await prisma.chat.updateMany({ where: { userId: null }, data: { userId: user.id } });

  return user;
}
