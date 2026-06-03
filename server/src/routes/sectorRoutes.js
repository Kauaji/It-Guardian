import { Router } from "express";
import { create, list, remove, update, updatePermissions } from "../controllers/sectorController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", list);
router.post("/", requireAdmin, create);
router.patch("/:id/permissions", requireAdmin, updatePermissions);
router.patch("/:id", requireAdmin, update);
router.delete("/:id", requireAdmin, remove);

export default router;
