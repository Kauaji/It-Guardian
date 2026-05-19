import { Router } from "express";
import {
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
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/public/:id", publicDetails);
router.use(requireAuth);
router.get("/", list);
router.post("/manual", requireRole("admin", "operator"), createManual);
router.patch("/:id/manual", requireRole("admin", "operator"), updateManual);
router.patch("/:id/type", requireRole("admin", "operator"), changeDeviceType);
router.post("/:id/ping", requireRole("admin", "operator"), refreshPing);
router.patch("/:id/segment", requireRole("admin", "operator"), moveToSegment);
router.get("/:id", details);
router.delete("/:id", requireRole("admin", "operator"), removeDevice);

export default router;
