import { Router } from "express";
import { clientController } from "../controllers/settingsController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", clientController.list);
router.get("/:id", clientController.details);
router.post("/", requirePermission("service_orders.settings"), clientController.create);
router.patch("/:id", requirePermission("service_orders.settings"), clientController.update);
router.delete("/:id", requirePermission("service_orders.settings"), clientController.remove);
router.post("/import", requirePermission("service_orders.settings"), clientController.importCsv);

export default router;
