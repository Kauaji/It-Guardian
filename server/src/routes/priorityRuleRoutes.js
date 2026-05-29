import { Router } from "express";
import { priorityRuleController } from "../controllers/settingsController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", priorityRuleController.list);
router.get("/:id", priorityRuleController.details);
router.post("/", requirePermission("service_orders.settings"), priorityRuleController.create);
router.patch("/:id", requirePermission("service_orders.settings"), priorityRuleController.update);
router.delete("/:id", requirePermission("service_orders.settings"), priorityRuleController.remove);

export default router;
