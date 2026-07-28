import { Router } from "express";
import {
  activations,
  changeStatus,
  configureMonitoring,
  create,
  deactivateActivation,
  list
} from "../controllers/productKeyController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth, requireAdmin);
router.get("/", list);
router.post("/", create);
router.get("/:id/activations", activations);
router.put("/:id/monitoring", configureMonitoring);
router.patch("/:id", changeStatus);
router.post("/activations/:id/deactivate", deactivateActivation);

export default router;
