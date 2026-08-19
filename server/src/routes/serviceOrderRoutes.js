import { Router } from "express";
import {
  addAttachment,
  addHistory,
  assignTechnician,
  changePriority,
  changeStatus,
  create,
  details,
  getFeedback,
  linkAsset,
  list,
  listAttachments,
  remove,
  removeAttachment,
  reopen,
  replaceItems,
  settings,
  submitFeedback,
  update,
  updateSettings
} from "../controllers/serviceOrderController.js";
import {
  getChecklistHandler,
  updateChecklistItemHandler
} from "../controllers/serviceOrderChecklistController.js";
import {
  serviceOrderScriptActivity,
  useForServiceOrder
} from "../controllers/maintenanceScriptController.js";
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
router.post("/:id/reopen", requirePermission("service_orders.reopen"), reopen);
router.get("/:id/feedback", requirePermission("service_orders.view"), getFeedback);
router.post("/:id/feedback", requirePermission("service_orders.attendance"), submitFeedback);
router.get("/:id/checklist", requirePermission("service_orders.view"), getChecklistHandler);
router.patch("/:id/checklist/:resultId", requirePermission("service_orders.attendance"), updateChecklistItemHandler);
router.get("/:id/attachments", requirePermission("service_orders.view"), listAttachments);
router.post("/:id/attachments", requirePermission("service_orders.attendance"), addAttachment);
router.delete("/:id/attachments/:attachmentId", requirePermission("service_orders.edit"), removeAttachment);
router.get("/:id/script-activity", requirePermission("service_orders.view"), serviceOrderScriptActivity);
router.post("/:id/scripts/:scriptId/use", requirePermission("service_orders.run_scripts"), useForServiceOrder);
router.delete("/:id", requirePermission("service_orders.edit"), remove);

export default router;
