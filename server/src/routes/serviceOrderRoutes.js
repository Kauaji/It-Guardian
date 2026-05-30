import { Router } from "express";
import {
  addHistory,
  assignTechnician,
  changePriority,
  changeStatus,
  create,
  details,
  linkAsset,
  list,
  remove,
  replaceItems,
  settings,
  update,
  updateSettings
} from "../controllers/serviceOrderController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission("service_orders.view"), list);
router.post("/", requirePermission("service_orders.create"), create);
router.get("/settings", requirePermission("service_orders.view"), settings);
router.patch("/settings", requirePermission("service_orders.settings"), updateSettings);
router.get("/:id", requirePermission("service_orders.view"), details);
router.patch("/:id/priority", requirePermission("service_orders.edit"), changePriority);
router.patch("/:id/technician", requirePermission("service_orders.assign"), assignTechnician);
router.patch("/:id/status", requirePermission("service_orders.change_status"), changeStatus);
router.patch("/:id/asset", requirePermission("service_orders.edit"), linkAsset);
router.post("/:id/items", requirePermission("service_orders.parts"), replaceItems);
router.patch("/:id", requirePermission("service_orders.edit"), update);
router.post("/:id/history", requirePermission("service_orders.attendance"), addHistory);
router.delete("/:id", requirePermission("service_orders.edit"), remove);

export default router;
