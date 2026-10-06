import { isMaintenanceSegmentName } from "../../../utils/display.js";
import { getSegmentGroupId } from "../inventoryUtils.js";

// Quantidade de dispositivos por segmento.
export function countDevicesBySegment(devices) {
  const next = new Map();
  for (const device of devices) {
    next.set(device.segmentId, (next.get(device.segmentId) || 0) + 1);
  }
  return next;
}

// Segmentos de manutencao que ainda possuem maquinas.
export function getOccupiedMaintenanceSegments(segments, countBySegment) {
  return segments.filter((segment) => (
    isMaintenanceSegmentName(segment.name || "") && (countBySegment.get(segment.id) || 0) > 0
  ));
}

// Segmentos (exceto manutencao) agrupados por grupo; a chave "" reune os sem grupo.
export function groupSegmentsByGroupId(segments, groups) {
  const next = new Map([["", []]]);

  for (const group of groups) {
    next.set(group.id, []);
  }

  for (const segment of segments) {
    if (isMaintenanceSegmentName(segment.name || "")) continue;
    const groupId = getSegmentGroupId(segment, groups);
    const list = next.get(groupId) || [];
    list.push(segment);
    next.set(groupId, list);
  }

  return next;
}

export function sumGroupCount(groupSegments, countBySegment) {
  return groupSegments.reduce((total, segment) => total + (countBySegment.get(segment.id) || 0), 0);
}
