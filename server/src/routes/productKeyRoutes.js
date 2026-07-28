import { Router } from "express";
import {
  activations,
  changeStatus,
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
router.patch("/:id", changeStatus);
router.post("/activations/:id/deactivate", deactivateActivation);

export default router;
