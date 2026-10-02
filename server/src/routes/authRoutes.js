import { Router } from "express";
import {
  changePassword,
  login,
  loginMfa,
  logout,
  me,
  mfaDisable,
  mfaEnable,
  mfaRecoveryCodes,
  mfaSetup,
  mfaStatus,
  register,
  revokeOneSession,
  revokeOtherSessions,
  sessions
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { authRateLimiter, createRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = Router();

const mfaRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip}:mfa`,
  name: "auth-mfa"
});
const sensitiveActionLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyGenerator: (req) => `${req.ip}:${req.user?.id || "anonymous"}:sensitive`,
  message: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  name: "auth-sensitive"
});

router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);
router.post("/login/mfa", mfaRateLimiter, loginMfa);
router.get("/me", requireAuth, me);
router.post("/logout", requireAuth, logout);
router.post("/password", requireAuth, sensitiveActionLimiter, changePassword);
router.get("/sessions", requireAuth, sessions);
router.post("/sessions/revoke-others", requireAuth, revokeOtherSessions);
router.delete("/sessions/:id", requireAuth, revokeOneSession);
router.get("/mfa/status", requireAuth, mfaStatus);
router.post("/mfa/setup", requireAuth, sensitiveActionLimiter, mfaSetup);
router.post("/mfa/enable", requireAuth, sensitiveActionLimiter, mfaEnable);
router.post("/mfa/disable", requireAuth, sensitiveActionLimiter, mfaDisable);
router.post("/mfa/recovery-codes", requireAuth, sensitiveActionLimiter, mfaRecoveryCodes);

export default router;
