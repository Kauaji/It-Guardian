import { Router } from "express";
import * as serviceOrderStatusController from "../controllers/serviceOrderStatusController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission("service_orders.view"), serviceOrderStatusController.list);
router.post("/", requirePermission("service_orders.settings"), serviceOrderStatusController.create);
router.patch("/:id", requirePermission("service_orders.settings"), serviceOrderStatusController.update);
router.delete("/:id", requirePermission("service_orders.settings"), serviceOrderStatusController.remove);

export default router;
