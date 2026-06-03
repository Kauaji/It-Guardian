import { Router } from "express";
import {
  createPublicServiceOrder,
  supportOptions
} from "../controllers/publicServiceOrderController.js";

const router = Router();

router.get("/support-options", supportOptions);
router.post("/service-orders", createPublicServiceOrder);

export default router;
