import { createSegment } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { upsertSegmentList } from "../../components/inventory/inventoryUtils.js";
import { isMaintenanceSegmentName } from "../../utils/display.js";

// Segmento de sistema "Manutenção": reaproveita o existente ou cria um novo
// (compartilhado entre abas e sempre no topo).
export function useMaintenanceSegment({ data, decoratedSegments, meta }) {
  const { token } = useAppSession();
  const { setSegments } = data;

  async function getOrCreateMaintenanceSegment() {
    const existingActive = decoratedSegments.find((segment) => !segment.isDefault && isMaintenanceSegmentName(segment.name));
    if (existingActive) return existingActive;

    const response = await createSegment(token, {
      name: "Manutenção",
      color: "#f59e0b",
      groupId: null,
      systemSegment: "maintenance"
    });
    const nextSegment = { ...response.segment, groupId: null };

    setSegments((current) => upsertSegmentList(current, nextSegment));
    meta.updateInventoryMeta("segments", response.segment.id, {
      tabId: "shared",
      order: -1
    });

    return nextSegment;
  }

  return { getOrCreateMaintenanceSegment };
}
