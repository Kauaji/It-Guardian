import { useEffect, useMemo, useState } from "react";

// Selecao multipla de ativos no inventario. Ids que saem da lista visivel
// (por busca, aba ou remocao) sao descartados automaticamente.
export function useAssetSelection({ activeAllDevices, visibleDevices }) {
  const [selectedAssetIds, setSelectedAssetIds] = useState(() => new Set());
  const [bulkMoveTarget, setBulkMoveTarget] = useState("");

  const selectedAssets = useMemo(
    () => activeAllDevices.filter((device) => selectedAssetIds.has(device.id)),
    [activeAllDevices, selectedAssetIds]
  );

  useEffect(() => {
    const visibleIds = new Set(visibleDevices.map((device) => device.id));

    setSelectedAssetIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));

      if (next.size === current.size) return current;
      if (next.size < 2) setBulkMoveTarget("");
      return next;
    });
  }, [visibleDevices]);

  function clearAssetSelection() {
    setSelectedAssetIds(new Set());
    setBulkMoveTarget("");
  }

  function handleSelectAsset(machine, { additive = false } = {}) {
    setSelectedAssetIds((current) => {
      const next = additive ? new Set(current) : new Set();

      if (additive && next.has(machine.id)) {
        next.delete(machine.id);
      } else {
        next.add(machine.id);
      }

      return next;
    });
  }

  function toggleAssetSelection(machineId) {
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      if (next.has(machineId)) {
        next.delete(machineId);
      } else {
        next.add(machineId);
      }
      return next;
    });
  }

  function selectOnly(machineId) {
    setSelectedAssetIds(new Set([machineId]));
  }

  function deselectAsset(machineId) {
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      next.delete(machineId);
      return next;
    });
  }

  return {
    bulkMoveTarget,
    clearAssetSelection,
    deselectAsset,
    handleSelectAsset,
    selectOnly,
    selectedAssetIds,
    selectedAssets,
    setBulkMoveTarget,
    toggleAssetSelection
  };
}
