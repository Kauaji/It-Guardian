import { inspectorConnections } from "../networkTopologyConnections.js";
import useTopologyInspectorConnections from "../useTopologyInspectorConnections.js";

/**
 * Item selecionado (no, vinculo ou cluster) e suas conexoes para o inspetor do mapa.
 */
export default function useTopologyInspection({
  token,
  scopeKey,
  canView,
  bundle,
  selection,
  visibleNodes,
  visibleLinks,
  devicesById,
  clusterSummaryByRefId
}) {
  const selectedNode = selection.selectedNodeId ? visibleNodes.find((node) => node.id === selection.selectedNodeId) : null;
  const selectedLink = selection.selectedLinkId ? visibleLinks.find((link) => link.id === selection.selectedLinkId) : null;
  const selectedClusterInfo = clusterSummaryByRefId.get(selectedNode?.refId) || null;
  const internalConnections = useTopologyInspectorConnections({
    token,
    node: selectedNode,
    scopeKey,
    enabled: canView && Boolean(selectedClusterInfo)
  });
  const selectedConnections = inspectorConnections({
    node: selectedNode,
    links: bundle?.links,
    internalLinks: internalConnections.links,
    devicesById,
    clustersById: clusterSummaryByRefId,
    clusterName: selectedClusterInfo?.name
  });

  return { selectedNode, selectedLink, selectedClusterInfo, selectedConnections, internalConnections };
}
