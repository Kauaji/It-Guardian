import { useCallback } from "react";

// Interacoes do canvas: ativar no, abrir cluster, criar conexao e limpar selecao.
export default function useTopologyInteractions({
  nav,
  selection,
  linkCreation,
  visibleNodes,
  clusterSummaryByRefId,
  canEditMap,
  linkDraftActive,
  creatingLink
}) {
  const { goToGroupLevel, goToSegmentLevel } = nav;
  const { setSelectedNodeId, setSelectedLinkId, setEditMode } = selection;

  const handleNodeActivate = useCallback(
    (nodeId) => {
      if (linkCreation.activate(visibleNodes.find((node) => node.id === nodeId))) return;
      setSelectedNodeId(nodeId);
      setSelectedLinkId(null);
    },
    [linkCreation, visibleNodes, setSelectedNodeId, setSelectedLinkId]
  );

  // Duplo-clique (ou "Abrir mapa" no inspector) num no-cluster leva pro
  // canvas de dentro dele - mesma navegacao ja usada pela sidebar/breadcrumb.
  const handleNodeOpen = useCallback(
    (node) => {
      if (linkDraftActive || creatingLink || !clusterSummaryByRefId.has(node.refId)) return;
      if (node.nodeType === "group") {
        goToGroupLevel(node.refId, { edit: canEditMap });
      } else if (node.nodeType === "segment") {
        goToSegmentLevel(node.refId, clusterSummaryByRefId.get(node.refId)?.groupId || null, { edit: canEditMap });
      }
    },
    [goToGroupLevel, goToSegmentLevel, clusterSummaryByRefId, linkDraftActive, creatingLink, canEditMap]
  );

  const handleToggleLinkDraft = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    if (linkDraftActive) {
      linkCreation.reset();
      return;
    }
    setEditMode(true);
    linkCreation.start();
  }, [linkCreation, linkDraftActive, setSelectedNodeId, setSelectedLinkId, setEditMode]);

  const handleCanvasBackgroundClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    linkCreation.reset();
  }, [linkCreation, setSelectedNodeId, setSelectedLinkId]);

  return { handleNodeActivate, handleNodeOpen, handleToggleLinkDraft, handleCanvasBackgroundClick };
}
