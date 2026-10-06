import { useMemo } from "react";
import { buildHierarchyTree, isTopologySegmentEligible } from "../networkTopologyHierarchy.js";

// Grupos e segmentos da aba ativa. O segmento padrao ("Nao organizadas"/
// backup) fica de fora da hierarquia: so tem lugar no mapa quem o tecnico
// organizou de verdade (segmento real, com ou sem grupo) - dispositivos
// sem segmento continuam so no Inventario ate serem organizados.
export default function useTopologyHierarchy({ groups, segments, devices, activeTab }) {
  const activeGroups = useMemo(
    () => groups.filter((group) => group.tabId === activeTab?.id),
    [groups, activeTab]
  );
  const activeSegments = useMemo(
    () => segments.filter((segment) => isTopologySegmentEligible(segment) && segment.tabId === activeTab?.id),
    [segments, activeTab]
  );
  const tree = useMemo(
    () => buildHierarchyTree({ groups: activeGroups, segments: activeSegments, devices }),
    [activeGroups, activeSegments, devices]
  );
  return { activeGroups, activeSegments, tree };
}
