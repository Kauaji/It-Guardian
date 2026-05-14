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
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", list);
router.get("/groups", listGroups);
router.post("/groups", requireRole("admin", "operator"), createGroup);
router.patch("/groups/:id", requireRole("admin", "operator"), renameGroup);
router.delete("/groups/:id", requireRole("admin", "operator"), removeGroup);
router.post("/", requireRole("admin", "operator"), create);
router.patch("/:id", requireRole("admin", "operator"), rename);
router.delete("/:id", requireRole("admin", "operator"), remove);

export default router;
