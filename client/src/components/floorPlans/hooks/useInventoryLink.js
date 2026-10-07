import { linkFloorPlanObjectToAsset } from "../../../api.js";
import { getInventoryLinkPatch } from "../utils/editorGeometry.js";
import { deviceLabel } from "../utils/planPresentation.js";

/** Vincula (ou desvincula) o objeto selecionado a uma maquina do inventario. */
export function useInventoryLink({ token, devices, permissions, notify, entities }) {
  const linkObject = async (objectId, assetId) => {
    const device = devices.find((entry) => entry.id === assetId);
    const patch = getInventoryLinkPatch(device, device ? deviceLabel(device) : undefined);
    entities.updateSelectedEntity(patch);
    if (!permissions.linkInventory || !objectId) return;
    try {
      await linkFloorPlanObjectToAsset(token, objectId, {
        assetId: patch.linkedAssetId,
        label: patch.label,
        groupId: patch.groupId,
        segmentId: patch.segmentId
      });
      notify?.("Vínculo atualizado.", "ok");
    } catch (requestError) {
      notify?.(requestError.message, "danger");
    }
  };

  return { linkObject };
}
