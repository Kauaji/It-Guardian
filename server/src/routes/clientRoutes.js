import { Router } from "express";
import { clientController } from "../controllers/settingsController.js";
import { requireAnyPermission, requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { serviceOrderCatalogReaders } from "./accessGroups.js";

const router = Router();

router.use(requireAuth);
router.get("/", requireAnyPermission(...serviceOrderCatalogReaders), clientController.list);
router.get("/:id", requireAnyPermission(...serviceOrderCatalogReaders), clientController.details);
router.post("/", requirePermission("service_orders.settings"), clientController.create);
router.patch("/:id", requirePermission("service_orders.settings"), clientController.update);
router.delete("/:id", requirePermission("service_orders.settings"), clientController.remove);
router.post("/import", requirePermission("service_orders.settings"), clientController.importCsv);

export default router;
