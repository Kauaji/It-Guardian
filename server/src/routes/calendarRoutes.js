import { Router } from "express";
import { cancel, create, details, list, remove, summary, update } from "../controllers/calendarController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();
router.use(requireAuth);
router.get("/events", requirePermission("calendar.view"), list);
router.post("/events", requirePermission("calendar.create"), create);
router.get("/events/:id", requirePermission("calendar.view"), details);
router.patch("/events/:id", requirePermission("calendar.update"), update);
router.post("/events/:id/cancel", requirePermission("calendar.cancel"), cancel);
router.delete("/events/:id", requirePermission("calendar.delete"), remove);
router.get("/summary", requirePermission("calendar.view"), summary);
export default router;
