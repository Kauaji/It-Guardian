import { Router } from "express";
import { priorityRuleController } from "../controllers/settingsController.js";
import { requireAnyPermission, requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { serviceOrderCatalogReaders } from "./accessGroups.js";

const router = Router();

router.use(requireAuth);
router.get("/", requireAnyPermission(...serviceOrderCatalogReaders), priorityRuleController.list);
router.get("/:id", requireAnyPermission(...serviceOrderCatalogReaders), priorityRuleController.details);
router.post("/", requirePermission("service_orders.settings"), priorityRuleController.create);
router.patch("/:id", requirePermission("service_orders.settings"), priorityRuleController.update);
router.delete("/:id", requirePermission("service_orders.settings"), priorityRuleController.remove);

export default router;
