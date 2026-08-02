import { Router } from "express";
import {
  completeJob,
  createManagedEnrollment,
  listManagedEnrollments,
  receive,
  revokeManagedEnrollment,
  supportLink
} from "../controllers/agentController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/enroll", receive);
router.post("/heartbeat", receive);
router.post("/inventory", receive);
router.post("/jobs/:id/result", completeJob);
router.get("/support-link", supportLink);

router.use(requireAuth, requireAdmin);
router.get("/enrollments", listManagedEnrollments);
router.post("/enrollments", createManagedEnrollment);
router.post("/enrollments/:id/revoke", revokeManagedEnrollment);

export default router;
