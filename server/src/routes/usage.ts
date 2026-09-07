import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getUsage } from "../controllers/usage";

const router = Router();
router.use(requireAuth);

router.get("/", getUsage);

export default router;
