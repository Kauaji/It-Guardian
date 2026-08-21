import { Router } from "express";
import {
  createPublicServiceOrder,
  publicMachineContext,
  supportOptions,
  trackPublicServiceOrder
} from "../controllers/publicServiceOrderController.js";
import { createRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = Router();

const publicReadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  name: "public-read"
});
const publicWriteRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Muitos chamados foram enviados desta conexao. Aguarde alguns minutos e tente novamente.",
  name: "public-write"
});

router.get("/support-options", publicReadRateLimiter, supportOptions);
router.get("/machine-context", publicReadRateLimiter, publicMachineContext);
router.post("/service-orders", publicWriteRateLimiter, createPublicServiceOrder);
router.get("/service-orders/track/:token", publicReadRateLimiter, trackPublicServiceOrder);

export default router;
