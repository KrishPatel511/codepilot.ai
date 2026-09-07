import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getRepos, getFiles, getFileContent, getTree } from "../controllers/github";

const router = Router();
router.use(requireAuth);

router.get("/repos", getRepos);
router.get("/files", getFiles);
router.get("/file", getFileContent);
router.get("/tree", getTree);

export default router;
