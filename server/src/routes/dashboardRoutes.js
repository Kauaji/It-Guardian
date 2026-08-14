import { Router } from "express";
import { summary } from "../controllers/dashboardController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/summary", requirePermission("dashboard.view"), summary);

export default router;
