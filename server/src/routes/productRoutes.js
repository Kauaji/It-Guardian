import { Router } from "express";
import { productController } from "../controllers/settingsController.js";
import { requireAnyPermission, requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { serviceOrderCatalogReaders } from "./accessGroups.js";

const router = Router();

router.use(requireAuth);
router.get("/", requireAnyPermission(...serviceOrderCatalogReaders), productController.list);
router.get("/:id", requireAnyPermission(...serviceOrderCatalogReaders), productController.details);
router.post("/", requirePermission("service_orders.settings"), productController.create);
router.patch("/:id", requirePermission("service_orders.settings"), productController.update);
router.delete("/:id", requirePermission("service_orders.settings"), productController.remove);
router.post("/import", requirePermission("service_orders.settings"), productController.importCsv);

export default router;
