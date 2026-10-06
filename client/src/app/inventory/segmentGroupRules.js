// Regras puras dos grupos de segmentos do inventário.
import { getSegmentGroupId } from "../../components/inventory/inventoryUtils.js";

/** Já existe outro grupo (diferente de `ignoreId`) com o mesmo nome, sem diferenciar caixa. */
export function hasDuplicateGroupName(groups, name, ignoreId) {
  const cleanName = name.trim().toLowerCase();
  return groups.some((group) => group.id !== ignoreId && group.name.trim().toLowerCase() === cleanName);
}

export function countSegmentsInGroup(segments, groups, groupId) {
  return segments.filter((segment) => getSegmentGroupId(segment, groups) === groupId).length;
}

export function deleteGroupConfirmation(group, segmentCount) {
  return segmentCount
    ? `Excluir o grupo "${group.name}" e mover ${segmentCount} segmento(s) para Sem grupo?`
    : `Excluir o grupo "${group.name}"?`;
}
