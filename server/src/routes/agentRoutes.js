import { Router } from "express";
import { createHash } from "node:crypto";
import {
  completeJob,
  createManagedEnrollment,
  listManagedEnrollments,
  receive,
  revokeManagedEnrollment,
  supportLink
} from "../controllers/agentController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import { createRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = Router();

const agentRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: (req) => {
    const authorization = String(req.headers.authorization || "");
    const identity = authorization || req.ip || "unknown";
    return createHash("sha256").update(identity).digest("hex");
  },
  message: "Limite temporario de comunicacoes do coletor atingido. Tente novamente em alguns minutos."
});

router.post("/enroll", agentRateLimiter, receive);
router.post("/heartbeat", agentRateLimiter, receive);
router.post("/inventory", agentRateLimiter, receive);
router.post("/jobs/:id/result", agentRateLimiter, completeJob);
router.get("/support-link", agentRateLimiter, supportLink);

router.use(requireAuth, requireAdmin);
router.get("/enrollments", listManagedEnrollments);
router.post("/enrollments", createManagedEnrollment);
router.post("/enrollments/:id/revoke", revokeManagedEnrollment);

export default router;
