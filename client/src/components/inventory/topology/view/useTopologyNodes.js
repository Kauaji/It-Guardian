import { useMemo } from "react";
import { isTopologySegmentEligible } from "../networkTopologyHierarchy.js";
import {
  hasTopologyConnectionPair,
  topologyLinkKey,
  topologyNodeKey
} from "../networkTopologyConnections.js";
import { buildInventoryTopologyNodes, getTopologySegments, resolveTopologyDisplayNodes } from "../networkTopologyProjection.js";
import { resolveConnectionItemLabels } from "./topologyViewConstants.js";

// Nos a exibir (inventario + mapa salvo), sem aplicar filtros nem posicoes pendentes.
export function useTopologyDisplayNodes({ bundle, viewLevel, tree, selectedGroupId, selectedSegmentId, segments, devices }) {
  const devicesById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);
  const inventoryNodes = useMemo(
    () => buildInventoryTopologyNodes({ tree, viewLevel, selectedGroupId, selectedSegmentId }),
    [tree, viewLevel, selectedGroupId, selectedSegmentId]
  );
  const excludedSegmentIds = useMemo(
    () => new Set(segments.filter((segment) => !isTopologySegmentEligible(segment)).map((segment) => segment.id)),
    [segments]
  );
  const displayNodes = useMemo(
    () => !bundle ? [] : viewLevel === "global-legado"
      ? bundle.nodes.filter((node) => node.nodeType !== "segment" || !excludedSegmentIds.has(node.refId))
      : resolveTopologyDisplayNodes(bundle.nodes, inventoryNodes),
    [bundle, viewLevel, inventoryNodes, excludedSegmentIds]
  );
  return { devicesById, displayNodes };
}

// Nos e conexoes visiveis (com filtros e posicoes pendentes) e dados derivados do mapa.
export function useTopologyVisibility({
  bundle, viewLevel, tree, devices, devicesById, displayNodes, filterPredicate, hasActiveFilter, dirtyPositions
}) {
  const visibleNodes = useMemo(() => {
    if (!bundle) return [];
    return displayNodes
      .filter((node) => {
        if (node.nodeType && node.nodeType !== "asset") return true;
        const device = devicesById.get(node.assetId);
        if (!device) return !hasActiveFilter;
        return filterPredicate(device);
      })
      .map((node) => {
        const dirty = dirtyPositions.get(topologyNodeKey(node));
        return dirty ? { ...node, x: dirty.x, y: dirty.y } : node;
      });
  }, [bundle, displayNodes, devicesById, filterPredicate, hasActiveFilter, dirtyPositions]);

  const connectionItemLabels = useMemo(
    () => resolveConnectionItemLabels(visibleNodes, viewLevel),
    [visibleNodes, viewLevel]
  );
  const canStartLink = useMemo(() => hasTopologyConnectionPair(visibleNodes), [visibleNodes]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleLinks = useMemo(() => {
    if (!bundle) return [];
    const nodeIdByRefKey = new Map(displayNodes.map((node) => [topologyNodeKey(node), node.id]));
    return bundle.links.filter((link) => {
      const sourceNodeId = nodeIdByRefKey.get(topologyLinkKey(link, "source"));
      const targetNodeId = nodeIdByRefKey.get(topologyLinkKey(link, "target"));
      return visibleNodeIds.has(sourceNodeId) && visibleNodeIds.has(targetNodeId);
    });
  }, [bundle, displayNodes, visibleNodeIds]);

  const availableDevicesToAdd = useMemo(() => {
    if (!bundle) return [];
    const usedAssetIds = new Set(bundle.nodes.map((node) => node.assetId));
    return devices.filter((device) => !usedAssetIds.has(device.id) && filterPredicate(device));
  }, [bundle, devices, filterPredicate]);

  // Resumo ao vivo (nome/status/contagem) de cada no-cluster persistido no
  // mapa, casado por refId - vem da mesma arvore (buildHierarchyTree) que
  // ja alimenta a sidebar, sem duplicar logica de agregacao.
  const clusterSummaryByRefId = useMemo(
    () => new Map([...tree.groups, ...getTopologySegments(tree)].map((entry) => [entry.id, entry])),
    [tree]
  );

  return {
    visibleNodes, visibleLinks, connectionItemLabels, canStartLink, availableDevicesToAdd, clusterSummaryByRefId
  };
}
