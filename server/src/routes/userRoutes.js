import { Router } from "express";
import { list, updateRole } from "../controllers/userController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));
router.get("/", list);
router.patch("/:id/role", updateRole);

export default router;
