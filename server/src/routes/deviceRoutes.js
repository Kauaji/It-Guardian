import { Router } from "express";
import {
  changeDeviceBackup,
  changeDeviceType,
  createManual,
  details,
  list,
  moveToSegment,
  publicDetails,
  refreshPing,
  removeDevice,
  updateManual
} from "../controllers/deviceController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/public/:id", publicDetails);
router.use(requireAuth);
router.get("/", requirePermission("inventory.view"), list);
router.post("/manual", requirePermission("inventory.create_asset"), createManual);
router.patch("/:id/manual", requirePermission("inventory.edit_asset"), updateManual);
router.patch("/:id/type", requirePermission("inventory.edit_asset"), changeDeviceType);
router.patch("/:id/backup", requirePermission("inventory.edit_asset"), changeDeviceBackup);
router.post("/:id/ping", requirePermission("inventory.edit_asset"), refreshPing);
router.patch("/:id/segment", requirePermission("inventory.move_assets"), moveToSegment);
router.get("/:id", requirePermission("inventory.view_machine"), details);
router.delete("/:id", requirePermission("inventory.edit_asset"), removeDevice);

export default router;
