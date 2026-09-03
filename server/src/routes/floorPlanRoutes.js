import { Router, raw } from "express";
import {
  createFloorPlanController,
  deleteFloorPlanController,
  duplicateFloorPlanController,
  deleteFloorPlanBackgroundController,
  floorPlanAssetHeatmapController,
  floorPlanServiceOrderHeatmapController,
  floorPlanSummaryController,
  getFloorPlanController,
  getFloorPlanBackgroundController,
  linkFloorPlanObjectController,
  listFloorPlanController,
  saveFloorPlanEditorDataController,
  updateFloorPlanController,
  uploadFloorPlanBackgroundController
} from "../controllers/floorPlanController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("floor_plans.view"), listFloorPlanController);
router.post("/", requirePermission("floor_plans.create"), createFloorPlanController);
router.patch("/objects/:objectId/link-equipment", requirePermission("floor_plans.link_inventory"), linkFloorPlanObjectController);
router.post("/:id/floors/:floorId/background", requirePermission("floor_plans.upload_background"), raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "8mb" }), uploadFloorPlanBackgroundController);
router.get("/:id/floors/:floorId/background", requirePermission("floor_plans.view"), getFloorPlanBackgroundController);
router.delete("/:id/floors/:floorId/background", requirePermission("floor_plans.upload_background"), deleteFloorPlanBackgroundController);
router.get("/:id/summary", requirePermission("floor_plans.view_heatmaps"), floorPlanSummaryController);
router.get("/:id/heatmap/assets", requirePermission("floor_plans.view_heatmaps"), floorPlanAssetHeatmapController);
router.get("/:id/heatmap/service-orders", requirePermission("floor_plans.view_heatmaps"), floorPlanServiceOrderHeatmapController);
router.get("/:id", requirePermission("floor_plans.view"), getFloorPlanController);
router.patch("/:id", requirePermission("floor_plans.update"), updateFloorPlanController);
router.patch("/:id/editor-data", requirePermission("floor_plans.update"), saveFloorPlanEditorDataController);
router.post("/:id/duplicate", requirePermission("floor_plans.create"), duplicateFloorPlanController);
router.delete("/:id", requirePermission("floor_plans.delete"), deleteFloorPlanController);

export default router;
