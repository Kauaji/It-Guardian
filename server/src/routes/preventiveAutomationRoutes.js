import { Router } from "express";
import {
  assetDetail,
  agenda,
  create,
  detail,
  disable,
  list,
  management,
  history,
  prepare,
  processDue,
  processDueCron,
  remove,
  removeAsset,
  removeAssetOverride,
  saveAssetOverride,
  update
} from "../controllers/preventiveAutomationController.js";
import { requireAuth, requirePermission } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/process-due/cron", processDueCron);
router.post("/process-due/cron", processDueCron);

router.use(requireAuth);
router.get("/", requirePermission("preventive_automation.view"), list);
router.get("/management", requirePermission("preventive_automation.view"), management);
router.get("/agenda", requirePermission("preventive_automation.view"), agenda);
router.post("/", requirePermission("preventive_automation.create"), create);
router.post("/process-due", requirePermission("preventive_automation.run_prepare"), processDue);
router.get("/:id", requirePermission("preventive_automation.view"), detail);
router.get("/:id/history", requirePermission("preventive_automation.view"), history);
router.get("/:id/assets/:assetId", requirePermission("preventive_automation.view"), assetDetail);
router.put(
  "/:id/assets/:assetId/override",
  requirePermission("preventive_automation.manage_asset_override"),
  saveAssetOverride
);
router.delete(
  "/:id/assets/:assetId/override",
  requirePermission("preventive_automation.manage_asset_override"),
  removeAssetOverride
);
router.delete(
  "/:id/assets/:assetId",
  requirePermission("preventive_automation.remove_asset"),
  removeAsset
);
router.patch("/:id", requirePermission("preventive_automation.update"), update);
router.post("/:id/disable", requirePermission("preventive_automation.disable"), disable);
router.delete("/:id", requirePermission("preventive_automation.delete"), remove);
router.post("/:id/prepare", requirePermission("preventive_automation.run_prepare"), prepare);

export default router;
