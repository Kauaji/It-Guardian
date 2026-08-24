import { Router } from "express";
import {
  getLayout,
  getWidgetCatalog,
  previewWidgetData,
  resetLayout,
  saveLayout
} from "../controllers/dashboardWidgetController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { createRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = Router();

// Arquivo separado de dashboardRoutes.js de proposito -- o endpoint /summary
// existente fica intocado, sem nenhum risco de regressao por causa desta
// rodada.
const layoutWriteLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  name: "dashboard-layout-write"
});
const widgetPreviewLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.id || req.ip,
  name: "dashboard-widget-preview"
});

router.use(requireAuth);
router.get("/layout", requirePermission("dashboard.view"), getLayout);
router.put("/layout", requirePermission("dashboard.customize"), layoutWriteLimiter, saveLayout);
router.post("/layout/reset", requirePermission("dashboard.customize"), layoutWriteLimiter, resetLayout);
router.get("/widgets/catalog", requirePermission("dashboard.view"), getWidgetCatalog);
router.post("/widgets/preview", requirePermission("dashboard.view"), widgetPreviewLimiter, previewWidgetData);

export default router;
