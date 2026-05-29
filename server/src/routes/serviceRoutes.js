import { Router } from "express";
import { serviceController } from "../controllers/settingsController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", serviceController.list);
router.get("/:id", serviceController.details);
router.post("/", requirePermission("service_orders.settings"), serviceController.create);
router.patch("/:id", requirePermission("service_orders.settings"), serviceController.update);
router.delete("/:id", requirePermission("service_orders.settings"), serviceController.remove);

export default router;
