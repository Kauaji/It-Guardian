import { Router } from "express";
import {
  createConnection,
  createMap,
  createObject,
  getMap,
  listConnections,
  listMaps,
  listObjects,
  removeConnection,
  removeMap,
  removeObject,
  updateConnection,
  updateMap,
  updateObject
} from "../controllers/inventoryVisualMapController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();
export const inventoryVisualMapObjectRoutes = Router();
export const inventoryVisualMapConnectionRoutes = Router();

router.use(requireAuth);
router.get("/", requirePermission("inventory.view"), listMaps);
router.get("/:id", requirePermission("inventory.view"), getMap);
router.post("/", requirePermission("inventory.manage_segments"), createMap);
router.patch("/:id", requirePermission("inventory.manage_segments"), updateMap);
router.delete("/:id", requirePermission("inventory.manage_segments"), removeMap);
router.get("/:id/objects", requirePermission("inventory.view"), listObjects);
router.post("/:id/objects", requirePermission("inventory.manage_segments"), createObject);
router.get("/:id/connections", requirePermission("inventory.view"), listConnections);
router.post("/:id/connections", requirePermission("inventory.manage_segments"), createConnection);

inventoryVisualMapObjectRoutes.use(requireAuth);
inventoryVisualMapObjectRoutes.patch("/:objectId", requirePermission("inventory.manage_segments"), updateObject);
inventoryVisualMapObjectRoutes.delete("/:objectId", requirePermission("inventory.manage_segments"), removeObject);

inventoryVisualMapConnectionRoutes.use(requireAuth);
inventoryVisualMapConnectionRoutes.patch("/:connectionId", requirePermission("inventory.manage_segments"), updateConnection);
inventoryVisualMapConnectionRoutes.delete("/:connectionId", requirePermission("inventory.manage_segments"), removeConnection);

export default router;
