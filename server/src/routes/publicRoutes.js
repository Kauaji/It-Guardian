import { Router } from "express";
import {
  createPublicServiceOrder,
  publicMachineContext,
  supportOptions
} from "../controllers/publicServiceOrderController.js";

const router = Router();

router.get("/support-options", supportOptions);
router.get("/machine-context", publicMachineContext);
router.post("/service-orders", createPublicServiceOrder);

export default router;
