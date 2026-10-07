import { useEffect, useMemo, useState } from "react";
import { buildGroupOptions, emptyLinkDraft, filterDevicesForLink, filterSegmentsForLink } from "../utils/assetLink.js";

// Assistente aba -> grupo -> segmento -> maquina que vincula um ativo a OS.
export function useAssetLinkWizard({ serviceOrder, devices, segments, groups, inventoryTabs, onUpdate }) {
  const [linking, setLinking] = useState(false);
  const [linkDraft, setLinkDraft] = useState(emptyLinkDraft);

  useEffect(() => {
    if (!serviceOrder) return;
    setLinking(false);
  }, [serviceOrder?.id]);

  const visibleGroups = useMemo(() => buildGroupOptions(segments, groups, linkDraft.tabId), [groups, segments, linkDraft.tabId]);
  const visibleSegments = useMemo(() => filterSegmentsForLink(segments, linkDraft), [segments, linkDraft.groupId, linkDraft.tabId]);
  const visibleDevices = useMemo(() => filterDevicesForLink(devices, segments, linkDraft), [devices, linkDraft, segments]);

  function toggleLinking() {
    setLinking((current) => !current);
  }

  function selectTab(tabId) {
    setLinkDraft({ tabId, groupId: "", segmentId: "", search: "" });
  }

  function selectGroup(groupId) {
    setLinkDraft((current) => ({ ...current, groupId, segmentId: "", search: "" }));
  }

  function selectSegment(segmentId) {
    setLinkDraft((current) => ({ ...current, segmentId }));
  }

  function changeSearch(search) {
    setLinkDraft((current) => ({ ...current, search }));
  }

  async function linkAsset(device) {
    const tab = inventoryTabs.find((item) => item.id === device.tabId) || inventoryTabs.find((item) => item.id === linkDraft.tabId);
    await onUpdate(serviceOrder.id, {
      assetId: device.id,
      environmentId: tab?.id || serviceOrder.environmentId,
      environmentName: tab?.name || serviceOrder.environmentName
    });
    setLinking(false);
  }

  return {
    linking,
    linkDraft,
    visibleGroups,
    visibleSegments,
    visibleDevices,
    toggleLinking,
    selectTab,
    selectGroup,
    selectSegment,
    changeSearch,
    linkAsset
  };
}
