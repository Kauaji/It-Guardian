import { Router } from "express";
import {
  analyze,
  create,
  list,
  recommendedScriptsForContext,
  registerSimulation,
  remove,
  update
} from "../controllers/maintenanceScriptController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission("scripts.view"), list);
router.post("/recommendations", requirePermission("scripts.view"), recommendedScriptsForContext);
router.post("/analyze", requirePermission("scripts.manage"), analyze);
router.post("/", requirePermission("scripts.manage"), create);
router.patch("/:id", requirePermission("scripts.manage"), update);
router.delete("/:id", requirePermission("scripts.manage"), remove);
router.post("/:id/register-simulation", requirePermission("scripts.register_simulation"), registerSimulation);

export default router;
