import { Router } from "express";
import {
  exportAlertsCsv,
  exportAssetsCsv,
  exportMonthlyCsv,
  exportRemoteAssistanceCsv,
  exportScriptsCsv,
  exportServiceOrdersCsv,
  exportSlaCsv,
  previewAlerts,
  previewAssets,
  previewMonthly,
  previewRemoteAssistance,
  previewScripts,
  previewServiceOrders,
  previewSla
} from "../controllers/reportController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { reportTypePermissions } from "../services/reportService.js";

const router = Router();

function viewGuards(type) {
  return reportTypePermissions[type].map((permission) => requirePermission(permission));
}

const exportGuard = requirePermission("reports.export");

router.use(requireAuth);

router.get("/monthly/preview", ...viewGuards("monthly"), previewMonthly);
router.get("/monthly/export.csv", ...viewGuards("monthly"), exportGuard, exportMonthlyCsv);

router.get("/service-orders/preview", ...viewGuards("service_orders"), previewServiceOrders);
router.get("/service-orders/export.csv", ...viewGuards("service_orders"), exportGuard, exportServiceOrdersCsv);

router.get("/sla/preview", ...viewGuards("sla"), previewSla);
router.get("/sla/export.csv", ...viewGuards("sla"), exportGuard, exportSlaCsv);

router.get("/assets/preview", ...viewGuards("assets"), previewAssets);
router.get("/assets/export.csv", ...viewGuards("assets"), exportGuard, exportAssetsCsv);

router.get("/alerts/preview", ...viewGuards("alerts"), previewAlerts);
router.get("/alerts/export.csv", ...viewGuards("alerts"), exportGuard, exportAlertsCsv);

router.get("/scripts/preview", ...viewGuards("scripts"), previewScripts);
router.get("/scripts/export.csv", ...viewGuards("scripts"), exportGuard, exportScriptsCsv);

router.get("/remote-assistance/preview", ...viewGuards("remote_assistance"), previewRemoteAssistance);
router.get("/remote-assistance/export.csv", ...viewGuards("remote_assistance"), exportGuard, exportRemoteAssistanceCsv);

export default router;
