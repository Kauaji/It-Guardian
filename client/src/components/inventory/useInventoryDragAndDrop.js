import { useCallback, useEffect, useMemo, useState } from "react";
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

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
      const kept = current.filter((id) => incoming.includes(id));
      const added = incoming.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [devices]);

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
    const overMachineId = event.over?.data?.current?.machineId;
    const targetType = event.over?.data?.current?.type;

    if (!machineId || !targetSegmentId) return null;

    const machine = devices.find((device) => device.id === machineId);
    if (!machine) return null;
    const selectedIds = selectedAssetIds.has(machineId) ? Array.from(selectedAssetIds) : [machineId];
    const movingMachines = selectedIds
      .map((id) => devices.find((device) => device.id === id))
      .filter(Boolean);

    if (overMachineId && machineId !== overMachineId && selectedIds.length === 1) {
      setOrderedIds((current) => {
        const oldIndex = current.indexOf(machineId);
        const newIndex = current.indexOf(overMachineId);
        return oldIndex >= 0 && newIndex >= 0 ? arrayMove(current, oldIndex, newIndex) : current;
      });
    }

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
  }, [devices, onMoveMachine, onMoveMachines, selectedAssetIds]);

  return {
    handleDragEnd,
    machinesBySegment,
    sensors
  };
}
