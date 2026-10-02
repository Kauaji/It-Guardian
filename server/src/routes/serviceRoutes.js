import { Router } from "express";
import { serviceController } from "../controllers/settingsController.js";
import { requireAnyPermission, requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { serviceOrderCatalogReaders } from "./accessGroups.js";

const router = Router();

router.use(requireAuth);
router.get("/", requireAnyPermission(...serviceOrderCatalogReaders), serviceController.list);
router.get("/:id", requireAnyPermission(...serviceOrderCatalogReaders), serviceController.details);
router.post("/", requirePermission("service_orders.settings"), serviceController.create);
router.patch("/:id", requirePermission("service_orders.settings"), serviceController.update);
router.delete("/:id", requirePermission("service_orders.settings"), serviceController.remove);

export default router;
