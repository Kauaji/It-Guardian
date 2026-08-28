import { isMaintenanceSegmentName } from "../../utils/display.js";

function isStandaloneSegment(segment) {
  return Boolean(segment.isDefault) || isMaintenanceSegmentName(segment.name || "");
}

export function getOccupiedInventorySegmentIds({ devices, machinesBySegment = new Map() } = {}) {
  // Prefer the live inventory before search/status filters. Summary machineCount
  // can still include a machine that has just returned from maintenance.
  if (Array.isArray(devices)) {
    return new Set(devices.map((device) => device.segmentId).filter(Boolean));
  }
  return new Set(
    [...machinesBySegment].filter(([, machines]) => machines.length > 0).map(([segmentId]) => segmentId)
  );
}

export function buildInventoryBoardSections({
  segments = [],
  groups = [],
  devices,
  machinesBySegment = new Map(),
  search = "",
  selectedGroupId = "all",
  selectedSegmentId = "all"
} = {}) {
  const segmentGroupIds = new Map();
  const searching = Boolean(search.trim());
  const occupiedSegmentIds = getOccupiedInventorySegmentIds({ devices, machinesBySegment });
  const availableSegments = segments.filter((segment) => (
    !isMaintenanceSegmentName(segment.name || "") || occupiedSegmentIds.has(segment.id)
  ));

  for (const group of groups) {
    for (const segmentId of group.segmentIds || []) {
      segmentGroupIds.set(segmentId, group.id);
    }
  }

  for (const segment of segments) {
    if (segment.groupId) segmentGroupIds.set(segment.id, segment.groupId);
  }

  const visibleSegments = availableSegments.filter((segment) => {
    if (searching) return (machinesBySegment.get(segment.id) || []).length > 0;
    if (selectedSegmentId !== "all") return segment.id === selectedSegmentId;

    // Maintenance retains its original ID/group metadata for moves and return
    // history, but it is a standalone section in the board, just like defaults.
    if (isStandaloneSegment(segment)) {
      return selectedGroupId === "all" || selectedGroupId === "ungrouped";
    }

    const groupId = segmentGroupIds.get(segment.id) || "";
    if (selectedGroupId === "ungrouped") return !groupId;
    return selectedGroupId === "all" || groupId === selectedGroupId;
  });

  const regularSegments = visibleSegments.filter((segment) => !isStandaloneSegment(segment));
  const groupedSections = groups
    .map((group) => ({
      ...group,
      segments: regularSegments.filter((segment) => segmentGroupIds.get(segment.id) === group.id)
    }))
    .filter((group) => {
      if (selectedGroupId !== "all" && selectedGroupId !== group.id) return false;
      if (searching && !group.segments.length) return false;
      return selectedSegmentId === "all" || group.segments.length > 0;
    });

  const ungroupedSegments = regularSegments.filter((segment) => !segmentGroupIds.get(segment.id));
  const standaloneSegments = [
    ...visibleSegments.filter((segment) => !segment.isDefault && isMaintenanceSegmentName(segment.name || "")),
    ...visibleSegments.filter((segment) => segment.isDefault)
  ];

  return { availableSegments, groupedSections, ungroupedSegments, standaloneSegments };
}
