import { Router } from "express";
import {
  getPreference,
  savePreference
} from "../controllers/userPreferenceController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/:key", getPreference);
router.put("/:key", savePreference);

export default router;
