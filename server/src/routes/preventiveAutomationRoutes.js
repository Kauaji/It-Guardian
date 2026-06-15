import { Router } from "express";
import {
  create,
  detail,
  disable,
  list,
  prepare,
  processDue,
  update
} from "../controllers/preventiveAutomationController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission("preventive_automation.view"), list);
router.post("/", requirePermission("preventive_automation.create"), create);
router.post("/process-due", requirePermission("preventive_automation.run_prepare"), processDue);
router.get("/:id", requirePermission("preventive_automation.view"), detail);
router.patch("/:id", requirePermission("preventive_automation.update"), update);
router.delete("/:id", requirePermission("preventive_automation.disable"), disable);
router.post("/:id/prepare", requirePermission("preventive_automation.run_prepare"), prepare);

export default router;
