import { Router } from "express";
import { activate } from "../controllers/productKeyController.js";
import { createRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = Router();

const activationRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.machineFingerprint || "").slice(0, 80)}`,
  message: "Muitas tentativas de ativacao. Aguarde alguns minutos e tente novamente.",
  name: "collector-activation"
});

router.post("/activate", activationRateLimiter, activate);

export default router;
