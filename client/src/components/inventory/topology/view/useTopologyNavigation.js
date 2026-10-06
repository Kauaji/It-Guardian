import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTopologySegments } from "../networkTopologyProjection.js";

// Nivel da hierarquia (Aba -> Grupo -> Segmento / global legado), navegacao e trilha.
export default function useTopologyNavigation({ activeTab, tree }) {
  const [viewLevel, setViewLevel] = useState("tab");
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const editIntentRef = useRef(null);

  const goToTabLevel = useCallback(() => {
    editIntentRef.current = null;
    setViewLevel("tab");
    setSelectedGroupId(null);
    setSelectedSegmentId(null);
  }, []);

  const goToGroupLevel = useCallback((groupId, { edit = false } = {}) => {
    editIntentRef.current = edit ? { scopeType: "group", scopeId: groupId } : null;
    setViewLevel("group");
    setSelectedGroupId(groupId);
    setSelectedSegmentId(null);
  }, []);

  const goToSegmentLevel = useCallback((segmentId, groupId = null, { edit = false } = {}) => {
    editIntentRef.current = edit ? { scopeType: "segment", scopeId: segmentId } : null;
    setViewLevel("segment");
    setSelectedSegmentId(segmentId);
    setSelectedGroupId(groupId);
  }, []);

  const goToGlobalLegacy = useCallback(() => {
    editIntentRef.current = null;
    setViewLevel("global-legado");
    setSelectedGroupId(null);
    setSelectedSegmentId(null);
  }, []);

  const selectedGroup = useMemo(
    () => (selectedGroupId ? tree.groups.find((group) => group.id === selectedGroupId) : null),
    [tree, selectedGroupId]
  );
  const selectedSegmentSummary = useMemo(
    () => getTopologySegments(tree).find((segment) => segment.id === selectedSegmentId) || null,
    [tree, selectedSegmentId]
  );
  const previousTabId = useRef(activeTab?.id);
  useEffect(() => {
    if (previousTabId.current !== activeTab?.id) {
      previousTabId.current = activeTab?.id;
      goToTabLevel();
    }
  }, [activeTab?.id, goToTabLevel]);

  useEffect(() => {
    if (viewLevel === "group" && !selectedGroup) goToTabLevel();
    if (viewLevel === "segment" && !selectedSegmentSummary) {
      if (selectedGroup) goToGroupLevel(selectedGroup.id);
      else goToTabLevel();
    }
  }, [viewLevel, selectedGroup, selectedSegmentSummary, goToGroupLevel, goToTabLevel]);

  const onNavigateBack = viewLevel === "segment" && selectedGroup
    ? () => goToGroupLevel(selectedGroup.id)
    : viewLevel === "segment" || viewLevel === "group" ? goToTabLevel : undefined;
  const backLabel = `Voltar para ${viewLevel === "segment" && selectedGroup ? selectedGroup.name : activeTab?.name || "os grupos"}`;

  const crumbs = useMemo(() => {
    if (viewLevel === "global-legado") {
      return [
        { label: activeTab?.name || "Aba", onClick: goToTabLevel },
        { label: "Visão Global (legado)" }
      ];
    }
    const list = [{ label: activeTab?.name || "Aba", onClick: viewLevel !== "tab" ? goToTabLevel : null }];
    if (selectedGroup) {
      list.push({ label: selectedGroup.name, onClick: viewLevel !== "group" ? () => goToGroupLevel(selectedGroup.id) : null });
    }
    if (viewLevel === "segment" && selectedSegmentSummary) {
      list.push({ label: selectedSegmentSummary.name });
    }
    return list;
  }, [viewLevel, activeTab, selectedGroup, selectedSegmentSummary, goToTabLevel, goToGroupLevel]);

  return {
    viewLevel, selectedGroupId, selectedSegmentId, selectedGroup, selectedSegmentSummary, editIntentRef,
    goToTabLevel, goToGroupLevel, goToSegmentLevel, goToGlobalLegacy, onNavigateBack, backLabel, crumbs
  };
}
