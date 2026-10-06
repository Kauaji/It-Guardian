import { useState } from "react";
import { updateDeviceSegment } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { backupSegmentId } from "../../components/inventory/inventoryLocalState.js";
import { findSegmentById } from "../inventory/inventoryModel.js";

const backupAreaMessage = "Use a ação Backup para enviar máquinas para a área de reserva.";
const backupBlockedMessage = "Máquinas Backup disponíveis só podem ser alocadas temporariamente por uma OS.";

// Movimentacao de ativos entre segmentos (individual e em lote), com
// atualizacao otimista e reversao em caso de erro, mais o estado do modal
// "Mover para...".
export function useInventoryMoves({ data, deviceState, inventory, meta }) {
  const { token, notify } = useAppSession();
  const { model, selection } = inventory;
  const { activeAllDevices, activeSegments, decoratedSegments } = model;
  const { segments, loadData } = data;
  const { selectedAssetIds, clearAssetSelection } = selection;
  const [moveModal, setMoveModal] = useState(null);
  const [moveTarget, setMoveTarget] = useState("");

  const lookupSegment = (segmentId) =>
    findSegmentById(segmentId, activeSegments, decoratedSegments, segments);

  async function handleMoveMachine(machine, segmentId, options = {}) {
    if (!machine || !segmentId || machine.segmentId === segmentId) {
      setMoveModal(null);
      return false;
    }

    if (segmentId === backupSegmentId) {
      notify(backupAreaMessage, "danger");
      return false;
    }

    if (machine.isBackup && machine.backupStatus !== "in_use" && !options.allowBackupMove) {
      notify(backupBlockedMessage, "danger");
      return false;
    }

    if (!options.forceSingle && selectedAssetIds.has(machine.id) && selectedAssetIds.size > 1) {
      return handleMoveMachines(Array.from(selectedAssetIds), segmentId, options);
    }

    const target = lookupSegment(segmentId);
    if (!target || target.isBackupSegment) {
      notify("Segmento de destino inválido.", "danger");
      return false;
    }
    const previousSegment = { id: machine.segmentId, name: machine.segmentName };
    const maintenanceExtra = options.reason === "maintenance" ? { maintenance: true } : {};

    meta.updateDeviceTabOwnership(machine.id, target, options.targetTabId);
    deviceState.updateDeviceSegmentInState(machine.id, segmentId, target?.name || "Segmento", maintenanceExtra);
    setMoveModal(null);

    try {
      const response = await updateDeviceSegment(token, machine.id, segmentId, options.reason ? { reason: options.reason } : {});
      deviceState.updateDeviceSegmentInState(
        machine.id,
        response.device.segmentId,
        response.device.segmentName,
        maintenanceExtra
      );
      notify(`${machine.name} movida para ${response.device.segmentName}.`, "ok");
      await loadData(true);
      clearAssetSelection();
      return true;
    } catch (error) {
      meta.updateDeviceTabOwnership(machine.id, lookupSegment(previousSegment.id), machine.tabId);
      deviceState.updateDeviceSegmentInState(machine.id, previousSegment.id, previousSegment.name);
      notify(error.message, "danger");
      return false;
    }
  }

  async function handleMoveMachines(machineIds, segmentId, options = {}) {
    if (!machineIds.length || !segmentId) return false;

    if (segmentId === backupSegmentId) {
      notify(backupAreaMessage, "danger");
      return false;
    }

    const target = lookupSegment(segmentId);
    if (!target || target.isBackupSegment) {
      notify("Segmento de destino inválido.", "danger");
      return false;
    }
    const machinesToMove = activeAllDevices.filter(
      (device) => machineIds.includes(device.id) && device.segmentId !== segmentId
    );
    const blockedBackup = machinesToMove.find(
      (machine) => machine.isBackup && machine.backupStatus !== "in_use" && !options.allowBackupMove
    );

    if (blockedBackup) {
      notify(backupBlockedMessage, "danger");
      return false;
    }

    if (!machinesToMove.length) {
      clearAssetSelection();
      return false;
    }

    const previous = new Map(machinesToMove.map((machine) => [
      machine.id,
      { id: machine.segmentId, name: machine.segmentName }
    ]));

    meta.updateDeviceTabOwnership(machinesToMove.map((machine) => machine.id), target, options.targetTabId);
    machinesToMove.forEach((machine) => {
      deviceState.updateDeviceSegmentInState(machine.id, segmentId, target?.name || "Segmento");
    });
    setMoveModal(null);

    try {
      await Promise.all(
        machinesToMove.map((machine) =>
          updateDeviceSegment(token, machine.id, segmentId, options.reason ? { reason: options.reason } : {})
        )
      );
      notify(`${machinesToMove.length} equipamentos movidos para ${target?.name || "Segmento"}.`, "ok");
      await loadData(true);
      clearAssetSelection();
      return true;
    } catch (error) {
      machinesToMove.forEach((machine) => {
        const fallback = previous.get(machine.id);
        meta.updateDeviceTabOwnership(machine.id, lookupSegment(fallback.id), machine.tabId);
        deviceState.updateDeviceSegmentInState(machine.id, fallback.id, fallback.name);
      });
      notify(error.message, "danger");
      return false;
    }
  }

  function handleBulkMove() {
    if (!selection.bulkMoveTarget || !selectedAssetIds.size) return;
    handleMoveMachines(Array.from(selectedAssetIds), selection.bulkMoveTarget);
  }

  function openMoveModal(machine, targetSegmentId = machine.segmentId) {
    setMoveModal(machine);
    setMoveTarget(targetSegmentId);
  }

  function closeMoveModal() {
    setMoveModal(null);
  }

  return {
    closeMoveModal,
    handleBulkMove,
    handleMoveMachine,
    handleMoveMachines,
    moveModal,
    moveTarget,
    openMoveModal,
    setMoveTarget
  };
}
