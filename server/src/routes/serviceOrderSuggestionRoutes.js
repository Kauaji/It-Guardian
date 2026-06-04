import { Router } from "express";
import {
  acceptSuggestion,
  rejectSuggestion,
  suggestions
} from "../controllers/alertController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission("alerts.view"), suggestions);
router.post(
  "/:id/accept",
  requirePermission("service_orders.create_from_alert"),
  acceptSuggestion
);
router.post(
  "/:id/reject",
  requirePermission("alerts.manage_suggestions"),
  rejectSuggestion
);

export default router;
