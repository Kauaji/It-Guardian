import { Router } from "express";
import { login, logout, me, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { authRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = Router();

router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);
router.get("/me", requireAuth, me);
router.post("/logout", logout);

export default router;
