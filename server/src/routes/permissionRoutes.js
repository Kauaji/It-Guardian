import { Router } from "express";
import { list } from "../controllers/permissionController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth, requireAdmin);
router.get("/", list);
router.get("/catalog", list);

export default router;
