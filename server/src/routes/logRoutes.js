import { Router } from "express";
import { list } from "../controllers/logController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));
router.get("/", list);

export default router;
