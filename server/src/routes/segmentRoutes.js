import { Router } from "express";
import {
  create,
  createGroup,
  list,
  listGroups,
  remove,
  removeGroup,
  rename,
  renameGroup
} from "../controllers/segmentController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission("inventory.view"), list);
router.get("/groups", requirePermission("inventory.view"), listGroups);
router.post("/groups", requirePermission("inventory.manage_segments"), createGroup);
router.patch("/groups/:id", requirePermission("inventory.manage_segments"), renameGroup);
router.delete("/groups/:id", requirePermission("inventory.manage_segments"), removeGroup);
router.post("/", requirePermission("inventory.manage_segments"), create);
router.patch("/:id", requirePermission("inventory.manage_segments"), rename);
router.delete("/:id", requirePermission("inventory.manage_segments"), remove);

export default router;
