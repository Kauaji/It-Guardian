import { Router } from "express";
import { cancelValidation } from "../controllers/maintenanceScriptController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.post("/:id/cancel", requirePermission("script_validations.manage"), cancelValidation);

export default router;
