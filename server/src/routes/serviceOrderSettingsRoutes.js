import { Router } from "express";
import { settings, updateSettings } from "../controllers/serviceOrderController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission("service_orders.settings"), settings);
router.patch("/", requirePermission("service_orders.settings"), updateSettings);

export default router;
