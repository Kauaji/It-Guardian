import { useMemo } from "react";
import { isMaintenanceSegmentName } from "../../../utils/display.js";
import { buildInventoryBoardSections } from "../inventoryBoardSections.js";

// Secoes do quadro (grupos, sem grupo, avulsos) e derivados usados pelos filtros.
export default function useBoardSections({ segments, groups, devices, machinesBySegment, search, selectedGroupId, selectedSegmentId }) {
  const { availableSegments, groupedSections, ungroupedSegments, standaloneSegments } = useMemo(
    () =>
      buildInventoryBoardSections({
        segments,
        groups,
        devices,
        machinesBySegment,
        search,
        selectedGroupId,
        selectedSegmentId
      }),
    [devices, groups, machinesBySegment, search, segments, selectedGroupId, selectedSegmentId]
  );
  const maintenanceSegment = availableSegments.find((segment) => isMaintenanceSegmentName(segment.name || ""));
  const backupSegment = availableSegments.find((segment) => segment.isBackupSegment || /backup/i.test(segment.name || ""));
  const showUngroupedSection =
    ungroupedSegments.length > 0 && (selectedGroupId === "all" || selectedGroupId === "ungrouped" || selectedSegmentId !== "all");
  const hasVisibleSections = groupedSections.length > 0 || showUngroupedSection || standaloneSegments.length > 0;

  return {
    availableSegments,
    groupedSections,
    ungroupedSegments,
    standaloneSegments,
    maintenanceSegment,
    backupSegment,
    showUngroupedSection,
    hasVisibleSections
  };
}
