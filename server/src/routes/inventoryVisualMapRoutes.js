import { Router } from "express";
import {
  createMap,
  createObject,
  getMap,
  listMaps,
  listObjects,
  removeMap,
  removeObject,
  updateMap,
  updateObject
} from "../controllers/inventoryVisualMapController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();
export const inventoryVisualMapObjectRoutes = Router();

router.use(requireAuth);
router.get("/", requirePermission("inventory.view"), listMaps);
router.get("/:id", requirePermission("inventory.view"), getMap);
router.post("/", requirePermission("inventory.manage_segments"), createMap);
router.patch("/:id", requirePermission("inventory.manage_segments"), updateMap);
router.delete("/:id", requirePermission("inventory.manage_segments"), removeMap);
router.get("/:id/objects", requirePermission("inventory.view"), listObjects);
router.post("/:id/objects", requirePermission("inventory.manage_segments"), createObject);

inventoryVisualMapObjectRoutes.use(requireAuth);
inventoryVisualMapObjectRoutes.patch("/:objectId", requirePermission("inventory.manage_segments"), updateObject);
inventoryVisualMapObjectRoutes.delete("/:objectId", requirePermission("inventory.manage_segments"), removeObject);

export default router;
