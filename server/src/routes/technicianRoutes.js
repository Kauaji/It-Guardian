import { Router } from "express";
import { technicianController } from "../controllers/settingsController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", technicianController.list);
router.get("/:id", technicianController.details);
router.post("/", requirePermission("service_orders.settings"), technicianController.create);
router.patch("/:id", requirePermission("service_orders.settings"), technicianController.update);
router.delete("/:id", requirePermission("service_orders.settings"), technicianController.remove);

export default router;
