import { Router } from "express";
import { create, list, remove, update, updatePermissions } from "../controllers/sectorController.js";
import { requireAdmin, requireAnyPermission, requireAuth } from "../middleware/authMiddleware.js";
import { serviceOrderCatalogReaders } from "./accessGroups.js";

const router = Router();

router.use(requireAuth);
router.get("/", requireAnyPermission(...serviceOrderCatalogReaders, "service_orders.change_sector"), list);
router.post("/", requireAdmin, create);
router.patch("/:id/permissions", requireAdmin, updatePermissions);
router.patch("/:id", requireAdmin, update);
router.delete("/:id", requireAdmin, remove);

export default router;
