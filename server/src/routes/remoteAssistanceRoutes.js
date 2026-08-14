import { Router } from "express";
import {
  chat,
  config,
  control,
  end,
  events,
  frame,
  input,
  monitor,
  pause,
  read,
  start,
  webrtcAnswer,
  webrtcOffer
} from "../controllers/remoteAssistanceController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { createRateLimiter } from "../middleware/rateLimitMiddleware.js";
import { protectRemoteAssistanceResponse } from "../middleware/remoteAssistanceSecurityMiddleware.js";

const router = Router();
const startLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  name: "remote-assistance-start"
});
const inputLimiter = createRateLimiter({
  windowMs: 10 * 1000,
  max: 500,
  keyGenerator: (req) => `${req.user?.id || req.ip}:${req.params.id}`,
  name: "remote-assistance-input"
});
const chatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `${req.user?.id || req.ip}:${req.params.id}`,
  name: "remote-assistance-chat"
});

router.use(requireAuth, protectRemoteAssistanceResponse);
router.get("/config", requirePermission("remote_assistance.view"), config);
router.post("/assets/:assetId/sessions", requirePermission("remote_assistance.start"), startLimiter, start);
router.get("/sessions/:id", requirePermission("remote_assistance.view"), read);
router.get("/sessions/:id/events", requirePermission("remote_assistance.view"), events);
router.get("/sessions/:id/frame", requirePermission("remote_assistance.view"), frame);
router.post("/sessions/:id/input", requirePermission("remote_assistance.control"), inputLimiter, input);
router.post("/sessions/:id/chat", requirePermission("remote_assistance.view"), chatLimiter, chat);
router.post("/sessions/:id/monitor", requirePermission("remote_assistance.view"), monitor);
router.post("/sessions/:id/pause", requirePermission("remote_assistance.view"), pause);
router.post("/sessions/:id/control", requirePermission("remote_assistance.control"), control);
router.post("/sessions/:id/webrtc/offer", requirePermission("remote_assistance.start"), webrtcOffer);
router.get("/sessions/:id/webrtc/answer", requirePermission("remote_assistance.view"), webrtcAnswer);
router.post("/sessions/:id/end", requirePermission("remote_assistance.end"), end);

export default router;
