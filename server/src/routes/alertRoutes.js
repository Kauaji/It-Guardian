import { Router } from "express";
import {
  acknowledge,
  active,
  evaluate,
  history,
  removeAcknowledgement,
  rules,
  settings,
  updateSettings,
  updateRule
} from "../controllers/alertController.js";
import { requireAuth, requirePermission, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission("alerts.view"), active);
router.get("/history", requirePermission("alerts.view"), history);
router.get("/rules", requirePermission("alerts.view"), rules);
router.get("/settings", requirePermission("alerts.view"), settings);
router.patch("/rules/:id", requirePermission("alerts.configure"), updateRule);
router.patch("/settings", requirePermission("alerts.configure"), updateSettings);
router.post("/evaluate", requirePermission("alerts.manage_suggestions"), evaluate);
router.post("/:id/acknowledge", requireRole("admin", "operator"), acknowledge);
router.delete("/:id/acknowledge", requireRole("admin", "operator"), removeAcknowledgement);

export default router;
