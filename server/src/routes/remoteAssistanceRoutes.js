import { Router } from "express";
import { config, control, end, events, frame, input, monitor, read, start } from "../controllers/remoteAssistanceController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { createRateLimiter } from "../middleware/rateLimitMiddleware.js";
import { protectRemoteAssistanceResponse } from "../middleware/remoteAssistanceSecurityMiddleware.js";

const router = Router();
const startLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip
});
const inputLimiter = createRateLimiter({
  windowMs: 10 * 1000,
  max: 500,
  keyGenerator: (req) => `${req.user?.id || req.ip}:${req.params.id}`
});

router.use(requireAuth, protectRemoteAssistanceResponse);
router.get("/config", requirePermission("remote_assistance.view"), config);
router.post("/assets/:assetId/sessions", requirePermission("remote_assistance.start"), startLimiter, start);
router.get("/sessions/:id", requirePermission("remote_assistance.view"), read);
router.get("/sessions/:id/events", requirePermission("remote_assistance.view"), events);
router.get("/sessions/:id/frame", requirePermission("remote_assistance.view"), frame);
router.post("/sessions/:id/input", requirePermission("remote_assistance.control"), inputLimiter, input);
router.post("/sessions/:id/monitor", requirePermission("remote_assistance.view"), monitor);
router.post("/sessions/:id/control", requirePermission("remote_assistance.control"), control);
router.post("/sessions/:id/end", requirePermission("remote_assistance.end"), end);

export default router;
