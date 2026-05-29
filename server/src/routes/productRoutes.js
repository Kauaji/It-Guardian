import { Router } from "express";
import { productController } from "../controllers/settingsController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", productController.list);
router.get("/:id", productController.details);
router.post("/", requirePermission("service_orders.settings"), productController.create);
router.patch("/:id", requirePermission("service_orders.settings"), productController.update);
router.delete("/:id", requirePermission("service_orders.settings"), productController.remove);
router.post("/import", requirePermission("service_orders.settings"), productController.importCsv);

export default router;
