import { Router } from "express";
import { problemTypeController } from "../controllers/settingsController.js";
import { requireAnyPermission, requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { serviceOrderCatalogReaders } from "./accessGroups.js";

const router = Router();

router.use(requireAuth);
router.get("/", requireAnyPermission(...serviceOrderCatalogReaders), problemTypeController.list);
router.get("/:id", requireAnyPermission(...serviceOrderCatalogReaders), problemTypeController.details);
router.post("/", requirePermission("service_orders.settings"), problemTypeController.create);
router.patch("/:id", requirePermission("service_orders.settings"), problemTypeController.update);
router.delete("/:id", requirePermission("service_orders.settings"), problemTypeController.remove);

export default router;
