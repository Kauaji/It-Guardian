import { Router } from "express";
import { acknowledge, active, history, removeAcknowledgement } from "../controllers/alertController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", active);
router.get("/history", history);
router.post("/:id/acknowledge", requireRole("admin", "operator"), acknowledge);
router.delete("/:id/acknowledge", requireRole("admin", "operator"), removeAcknowledgement);

export default router;
