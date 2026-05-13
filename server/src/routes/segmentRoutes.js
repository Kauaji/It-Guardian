import { Router } from "express";
import { create, list, remove, rename } from "../controllers/segmentController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", list);
router.post("/", requireRole("admin", "operator"), create);
router.patch("/:id", requireRole("admin", "operator"), rename);
router.delete("/:id", requireRole("admin", "operator"), remove);

export default router;
