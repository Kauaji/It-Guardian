import { Router } from "express";
import { reauthenticate } from "../controllers/securityController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";
import { createRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = Router();
const reauthenticationRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}:${req.user?.id || "anonymous"}:remote-assistance`,
  message: "Muitas tentativas de confirmacao de senha. Aguarde alguns minutos.",
  name: "security-reauthenticate"
});

router.post(
  "/reauthenticate",
  requireAuth,
  requirePermission("security.reauthenticate"),
  reauthenticationRateLimiter,
  reauthenticate
);

export default router;
