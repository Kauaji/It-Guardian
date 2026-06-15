import { Router } from "express";
import {
  acceptSuggestion,
  rejectSuggestion,
  suggestions
} from "../controllers/alertController.js";
import {
  suggestionRecommendedScripts,
  suggestionValidations,
  useFromSuggestion
} from "../controllers/maintenanceScriptController.js";
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
router.get(
  "/:id/recommended-scripts",
  requirePermission("scripts.view"),
  suggestionRecommendedScripts
);
router.post(
  "/:id/scripts/:scriptId/use",
  requirePermission("scripts.use_from_alert"),
  useFromSuggestion
);
router.get(
  "/:id/script-validations",
  requirePermission("scripts.view"),
  suggestionValidations
);

export default router;
