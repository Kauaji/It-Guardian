import { useCallback, useEffect, useMemo, useState } from "react";
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

export function useInventoryDragAndDrop({
  devices,
  filteredDevices,
  segments,
  selectedAssetIds = new Set(),
  onMoveMachine,
  onMoveMachines
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );
  const [orderedIds, setOrderedIds] = useState([]);

  useEffect(() => {
    setOrderedIds((current) => {
      const incoming = devices.map((device) => device.id);
      const incomingSet = new Set(incoming);
      const kept = current.filter((id) => incomingSet.has(id));
      const keptSet = new Set(kept);
      const added = incoming.filter((id) => !keptSet.has(id));
      return [...kept, ...added];
    });
  }, [devices]);

  const deviceById = useMemo(
    () => new Map(devices.map((device) => [device.id, device])),
    [devices]
  );

  const sortedDevices = useMemo(() => {
    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));

    return [...filteredDevices].sort(
      (left, right) => (orderMap.get(left.id) ?? 9999) - (orderMap.get(right.id) ?? 9999)
    );
  }, [filteredDevices, orderedIds]);

  const machinesBySegment = useMemo(() => {
    const grouped = new Map(segments.map((segment) => [segment.id, []]));

    for (const device of sortedDevices) {
      const target = grouped.has(device.segmentId) ? device.segmentId : segments[0]?.id;
      if (target) grouped.get(target).push(device);
    }

    return grouped;
  }, [segments, sortedDevices]);

  const handleDragEnd = useCallback((event) => {
    const machineId = event.active?.data?.current?.machineId;
    const targetSegmentId = event.over?.data?.current?.segmentId;
    const targetType = event.over?.data?.current?.type;

    if (!machineId || !targetSegmentId) return null;

    const machine = deviceById.get(machineId);
    if (!machine) return null;
    const selectedIds = selectedAssetIds.has(machineId) ? Array.from(selectedAssetIds) : [machineId];
    const movingMachines = selectedIds
      .map((id) => deviceById.get(id))
      .filter(Boolean);

    const alreadyInTarget = movingMachines.every((item) => item.segmentId === targetSegmentId);
    if (alreadyInTarget) {
      return { machine, machineIds: selectedIds, targetSegmentId, targetType, moved: false };
    }

    if (selectedIds.length > 1 && onMoveMachines) {
      onMoveMachines(selectedIds, targetSegmentId);
    } else {
      onMoveMachine(machine, targetSegmentId);
    }
    return { machine, machineIds: selectedIds, targetSegmentId, targetType, moved: true };
  }, [deviceById, onMoveMachine, onMoveMachines, selectedAssetIds]);

  return {
    handleDragEnd,
    machinesBySegment,
    sensors
  };
}
