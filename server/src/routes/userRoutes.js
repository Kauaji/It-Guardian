import { Router } from "express";
import {
  createManaged,
  list,
  removeManaged,
  resetMfa,
  resetPassword,
  updateAccess,
  updatePermissions,
  updateRole
} from "../controllers/userController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth, requireAdmin);
router.get("/", list);
router.post("/", createManaged);
router.patch("/:id/permissions", updatePermissions);
router.patch("/:id", updateAccess);
router.patch("/:id/role", updateRole);
router.post("/:id/reset-password", resetPassword);
router.post("/:id/mfa/reset", resetMfa);
router.delete("/:id", removeManaged);

export default router;
