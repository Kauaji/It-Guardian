import { Router } from "express";
import { details, update } from "../controllers/systemSettingsController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", details);
router.patch("/", requirePermission("settings.system_mode"), update);

export default router;
