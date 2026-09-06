import { Router, Request, Response } from "express";
import { listRepos, listRepoFiles, readFile, getFullRepoTree } from "../services/github";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/repos", async (req: Request, res: Response) => {
  try {
    const repos = await listRepos(req.user!.accessToken);
    res.json(repos);
  } catch (error: any) {
    console.error("GitHub repos error:", error.message);
    res.status(500).json({ error: "Failed to fetch repos" });
  }
});

router.get("/files", async (req: Request, res: Response) => {
  try {
    const { owner, repo, path } = req.query;
    if (!owner || !repo) {
      return res.status(400).json({ error: "owner and repo are required query params" });
    }
    const files = await listRepoFiles(req.user!.accessToken, owner as string, repo as string, (path as string) || "");
    res.json(files);
  } catch (error: any) {
    console.error("GitHub files error:", error.message);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

router.get("/file", async (req: Request, res: Response) => {
  try {
    const { owner, repo, path } = req.query;
    if (!owner || !repo || !path) {
      return res.status(400).json({ error: "owner, repo and path are required query params" });
    }
    const content = await readFile(req.user!.accessToken, owner as string, repo as string, path as string);
    res.json({ content });
  } catch (error: any) {
    console.error("GitHub file error:", error.message);
    res.status(500).json({ error: "Failed to read file" });
  }
});

router.get("/tree", async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.query;
    if (!owner || !repo) {
      return res.status(400).json({ error: "owner and repo are required query params" });
    }
    const tree = await getFullRepoTree(req.user!.accessToken, owner as string, repo as string);
    res.json(tree);
  } catch (error: any) {
    console.error("GitHub tree error:", error.message);
    res.status(500).json({ error: "Failed to fetch repo tree" });
  }
});

export default router;
