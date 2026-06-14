import { Router } from "express";
import { create, list, remove, reorder, update } from "../controllers/inventoryTabController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission("inventory.view"), list);
router.post("/", requirePermission("inventory.manage_segments"), create);
router.patch("/reorder", requirePermission("inventory.manage_segments"), reorder);
router.patch("/:id", requirePermission("inventory.manage_segments"), update);
router.delete("/:id", requirePermission("inventory.manage_segments"), remove);

export default router;
