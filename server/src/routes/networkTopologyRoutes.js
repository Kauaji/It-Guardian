import { Router } from "express";
import {
  createNetworkTopologyLinkController,
  createNetworkTopologyMapController,
  createNetworkTopologyNodeController,
  deleteNetworkTopologyLinkController,
  deleteNetworkTopologyMapController,
  deleteNetworkTopologyNodeController,
  generateNetworkTopologyAutoLayoutController,
  getNetworkTopologyMapByScopeController,
  getNetworkTopologyMapController,
  listNetworkTopologyMapsController,
  saveNetworkTopologyNodePositionsController,
  updateNetworkTopologyLinkController,
  updateNetworkTopologyMapController,
  updateNetworkTopologyNodeController
} from "../controllers/networkTopologyController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();
export const networkTopologyNodeRoutes = Router();
export const networkTopologyLinkRoutes = Router();

router.use(requireAuth);
router.get("/", requirePermission("inventory.topology.view"), listNetworkTopologyMapsController);
// Precisa vir antes de "/:id" - senao o Express casa "by-scope" como o id.
router.get("/by-scope", requirePermission("inventory.topology.view"), getNetworkTopologyMapByScopeController);
router.get("/:id", requirePermission("inventory.topology.view"), getNetworkTopologyMapController);
router.post("/", requirePermission("inventory.topology.manage"), createNetworkTopologyMapController);
router.patch("/:id", requirePermission("inventory.topology.manage"), updateNetworkTopologyMapController);
router.delete("/:id", requirePermission("inventory.topology.manage"), deleteNetworkTopologyMapController);
router.post("/:id/nodes", requirePermission("inventory.topology.manage"), createNetworkTopologyNodeController);
router.patch(
  "/:id/nodes/positions",
  requirePermission("inventory.topology.manage"),
  saveNetworkTopologyNodePositionsController
);
router.post(
  "/:id/auto-layout",
  requirePermission("inventory.topology.manage"),
  generateNetworkTopologyAutoLayoutController
);
router.post("/:id/links", requirePermission("inventory.topology.link_assets"), createNetworkTopologyLinkController);

networkTopologyNodeRoutes.use(requireAuth);
networkTopologyNodeRoutes.patch(
  "/:nodeId",
  requirePermission("inventory.topology.manage"),
  updateNetworkTopologyNodeController
);
networkTopologyNodeRoutes.delete(
  "/:nodeId",
  requirePermission("inventory.topology.manage"),
  deleteNetworkTopologyNodeController
);

networkTopologyLinkRoutes.use(requireAuth);
networkTopologyLinkRoutes.patch(
  "/:linkId",
  requirePermission("inventory.topology.link_assets"),
  updateNetworkTopologyLinkController
);
networkTopologyLinkRoutes.delete(
  "/:linkId",
  requirePermission("inventory.topology.link_assets"),
  deleteNetworkTopologyLinkController
);

export default router;
