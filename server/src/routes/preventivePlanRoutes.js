import { Router } from "express";
import {
  create,
  createServiceOrder,
  detail,
  list,
  logs,
  prepare
} from "../controllers/preventivePlanController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission("preventive_plans.view"), list);
router.post("/", requirePermission("preventive_plans.create"), create);
router.get("/:id", requirePermission("preventive_plans.view"), detail);
router.post("/:id/prepare", requirePermission("preventive_plans.prepare"), prepare);
router.post(
  "/:id/service-order",
  requirePermission("preventive_plans.prepare"),
  requirePermission("service_orders.create"),
  createServiceOrder
);
router.get("/:id/logs", requirePermission("preventive_plans.view"), logs);

export default router;
