import { Router } from "express";
import {
  acknowledgeLog,
  applySuggestedSolution,
  getLog,
  pendingLogs
} from "../controllers/maintenanceScriptController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/pending", requirePermission("script_logs.view"), pendingLogs);
router.get("/:id", requirePermission("script_logs.view"), getLog);
router.post("/:id/acknowledge", requirePermission("script_logs.resolve"), acknowledgeLog);
router.post("/:id/apply-suggested-solution", requirePermission("script_logs.resolve"), applySuggestedSolution);

export default router;
