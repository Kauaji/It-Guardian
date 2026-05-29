import { Router } from "express";
import {
  createManaged,
  list,
  removeManaged,
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
router.delete("/:id", removeManaged);

export default router;
