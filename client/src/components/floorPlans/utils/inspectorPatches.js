import { isSegmentCompatibleWithGroup } from "./infrastructure.js";

export const RACK_SWITCH_DEFAULT_PORTS = 24;

/** Patch que mescla `values` nos metadados da entidade sem perder os demais. */
export function buildMetadataPatch(entity, values) {
  return { metadata: { ...(entity.metadata || {}), ...values } };
}

/**
 * Patch ao trocar o grupo de um ativo: o segmento so permanece se ainda for
 * compativel com o novo grupo.
 */
export function buildGroupChangePatch(entity, groupId, segments) {
  const segmentStillValid = !entity.segmentId || segments.some((segment) => (
    segment.id === entity.segmentId && isSegmentCompatibleWithGroup(segment, groupId)
  ));
  return { groupId, segmentId: segmentStillValid ? entity.segmentId : null };
}

/** Patch ao trocar o tipo da porta: ajusta o sentido de abertura ou de correr. */
export function buildDoorTypePatch(entity, doorType) {
  const isSwing = doorType === "single" || doorType === "double";
  return buildMetadataPatch(entity, {
    doorType,
    ...(isSwing
      ? { swing: entity.metadata?.swing || "inward" }
      : { slideDirection: entity.metadata?.slideDirection || "right" })
  });
}

/** Patch ao vincular (ou desvincular) uma abertura a uma parede. */
export function buildOpeningWallPatch(entity, wallId) {
  return buildMetadataPatch(entity, {
    anchorType: wallId ? "wall" : null,
    parentObjectId: wallId || null,
    anchorOffset: entity.metadata?.anchorOffset ?? 0.5
  });
}

/** Patch que instala ou remove o switch de um rack. */
export function buildRackSwitchPatch(entity, installed) {
  return buildMetadataPatch(entity, installed
    ? {
      switchInstalled: true,
      switchTotalPorts: RACK_SWITCH_DEFAULT_PORTS,
      switchWorkingPorts: RACK_SWITCH_DEFAULT_PORTS
    }
    : { switchInstalled: false, switchTotalPorts: null, switchWorkingPorts: null });
}

/** Localiza a entidade selecionada na colecao correspondente do editor. */
export function findSelectedEntity(editor, selected) {
  if (!editor || !selected) return null;
  const collections = {
    object: editor.objects || [],
    zone: editor.zones || [],
    point: editor.connectionPoints || [],
    route: editor.cableRoutes || []
  };
  return collections[selected.type]?.find((item) => item.id === selected.id) || null;
}
