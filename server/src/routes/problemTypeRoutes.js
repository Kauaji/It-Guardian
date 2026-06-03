import { Router } from "express";
import { problemTypeController } from "../controllers/settingsController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", problemTypeController.list);
router.get("/:id", problemTypeController.details);
router.post("/", requirePermission("service_orders.settings"), problemTypeController.create);
router.patch("/:id", requirePermission("service_orders.settings"), problemTypeController.update);
router.delete("/:id", requirePermission("service_orders.settings"), problemTypeController.remove);

export default router;
