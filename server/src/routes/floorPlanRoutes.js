import { Router } from "express";
import {
  createFloorPlanController,
  deleteFloorPlanController,
  duplicateFloorPlanController,
  getFloorPlanController,
  linkFloorPlanObjectController,
  listFloorPlanController,
  saveFloorPlanEditorDataController,
  updateFloorPlanController
} from "../controllers/floorPlanController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("floor_plans.view"), listFloorPlanController);
router.post("/", requirePermission("floor_plans.create"), createFloorPlanController);
router.patch("/objects/:objectId/link-equipment", requirePermission("floor_plans.link_inventory"), linkFloorPlanObjectController);
router.get("/:id", requirePermission("floor_plans.view"), getFloorPlanController);
router.patch("/:id", requirePermission("floor_plans.update"), updateFloorPlanController);
router.patch("/:id/editor-data", requirePermission("floor_plans.update"), saveFloorPlanEditorDataController);
router.post("/:id/duplicate", requirePermission("floor_plans.create"), duplicateFloorPlanController);
router.delete("/:id", requirePermission("floor_plans.delete"), deleteFloorPlanController);

export default router;
