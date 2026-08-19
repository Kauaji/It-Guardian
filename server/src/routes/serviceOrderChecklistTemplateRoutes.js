import { Router } from "express";
import {
  createTemplateHandler,
  listTemplatesHandler,
  removeTemplateHandler,
  updateChecklistPolicyHandler,
  updateTemplateHandler
} from "../controllers/serviceOrderChecklistController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission("service_orders.view"), listTemplatesHandler);
router.post("/", requirePermission("service_orders.manage_checklists"), createTemplateHandler);
router.patch("/policy", requirePermission("service_orders.manage_checklists"), updateChecklistPolicyHandler);
router.patch("/:id", requirePermission("service_orders.manage_checklists"), updateTemplateHandler);
router.delete("/:id", requirePermission("service_orders.manage_checklists"), removeTemplateHandler);

export default router;
