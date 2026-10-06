import { backupSegmentId } from "../../components/inventory/inventoryLocalState.js";
import { getSegmentGroupId } from "../../components/inventory/inventoryUtils.js";
import { isMaintenanceSegmentName } from "../../utils/display.js";
import { findSegmentById } from "./inventoryModel.js";

// Consultas puras sobre segmentos/ativos usadas pelos fluxos de manutencao e
// de maquina Backup. `lists` agrupa as tres fontes de segmentos do App:
// { activeSegments, decoratedSegments, segments }.

export function getDefaultInventorySegment({ activeSegments, decoratedSegments, segments }) {
  return (
    activeSegments.find((segment) => segment.isDefault && !segment.isBackupSegment) ||
    decoratedSegments.find((segment) => segment.isDefault && !segment.isBackupSegment) ||
    segments.find((segment) => segment.isDefault)
  );
}

export function getBackupOrigin(machine) {
  const isInBackupArea = machine.segmentId === backupSegmentId;
  return {
    originalSegmentId: machine.backupRealSegmentId || machine.backupOriginalSegmentId || (isInBackupArea ? "" : machine.segmentId),
    originalSegmentName: machine.backupRealSegmentName || machine.backupOriginalSegmentName || (isInBackupArea ? "" : machine.segmentName)
  };
}

export function getRealBackupLocation(machine, lists) {
  const fallback = getDefaultInventorySegment(lists);
  const hasOwnSegment = machine?.segmentId && machine.segmentId !== backupSegmentId;
  const segmentId = machine?.backupRealSegmentId || machine?.backupOriginalSegmentId || (hasOwnSegment ? machine.segmentId : "");
  const segmentName = machine?.backupRealSegmentName || machine?.backupOriginalSegmentName || (hasOwnSegment ? machine.segmentName : "");

  const segment = (segmentId && findSegmentById(segmentId, lists.decoratedSegments, lists.activeSegments, lists.segments)) || fallback;

  return {
    segmentId: segment?.id || segmentId || fallback?.id,
    segmentName: segment?.name || segmentName || fallback?.name || "Não organizadas",
    segment
  };
}

// Descobre o segmento de origem da maquina principal de uma OS: primeiro o
// registro de manutencao, depois o segmento atual e, por fim, o padrao.
export function getServiceOrderAssetOrigin({ activeTabId, decoratedSegmentGroups, lists, machine, maintenanceRecords, order }) {
  const record = maintenanceRecords[machine.id];
  const origin = record?.origin || machine.maintenanceOrigin;
  if (origin?.segmentId && origin.segmentId !== backupSegmentId && !isMaintenanceSegmentName(origin.segmentName)) {
    return origin;
  }

  if (machine.segmentId && machine.segmentId !== backupSegmentId && !isMaintenanceSegmentName(machine.segmentName)) {
    return {
      tabId:
        machine.tabId && machine.tabId !== "global-unorganized" && machine.tabId !== "global-backup"
          ? machine.tabId
          : order?.environmentId || activeTabId,
      groupId: getSegmentGroupId(
        lists.decoratedSegments.find((segment) => segment.id === machine.segmentId),
        decoratedSegmentGroups
      ),
      segmentId: machine.segmentId,
      segmentName: machine.segmentName
    };
  }

  const fallback = getDefaultInventorySegment(lists);
  return fallback
    ? {
        tabId: order?.environmentId || activeTabId,
        groupId: "",
        segmentId: fallback.id,
        segmentName: fallback.name
      }
    : null;
}
