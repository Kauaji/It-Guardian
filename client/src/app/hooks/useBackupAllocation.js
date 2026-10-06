import { updateDeviceBackup } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { findSegmentById } from "../inventory/inventoryModel.js";
import {
  getDefaultInventorySegment,
  getRealBackupLocation,
  getServiceOrderAssetOrigin
} from "../inventory/segmentLookups.js";
import { buildBackupHistoryEvent } from "./backupHistory.js";

// Aloca uma maquina Backup no lugar da maquina principal de uma OS.
export function useBackupAllocation({ data, deviceState, inventory, maintenanceEntry, moves, serviceOrderCore }) {
  const { token, notify, user } = useAppSession();
  const { model, persistence } = inventory;
  const { activeInventoryTab, activeSegments, decoratedSegmentGroups, decoratedSegments, findDecoratedDevice } = model;
  const { loadData, segments } = data;
  const segmentLists = { activeSegments, decoratedSegments, segments };

  async function handleSelectBackupForServiceOrder(order, backupMachine) {
    if (!order || !backupMachine) return false;

    if (!order.assetId) {
      notify("Vincule a máquina principal antes de selecionar um Backup.", "danger");
      return false;
    }

    if (!backupMachine.isBackup) {
      notify("Selecione uma máquina marcada como Backup.", "danger");
      return false;
    }

    if (backupMachine.backupStatus === "in_use") {
      notify("Esta máquina Backup já está em uso em outra OS.", "danger");
      return false;
    }

    const mainMachine = findDecoratedDevice(order.assetId);
    if (!mainMachine) {
      notify("Não foi possível localizar a máquina principal da OS.", "danger");
      return false;
    }

    const targetOrigin = getServiceOrderAssetOrigin({
      activeTabId: activeInventoryTab.id,
      decoratedSegmentGroups,
      lists: segmentLists,
      machine: mainMachine,
      maintenanceRecords: persistence.maintenanceRecords,
      order
    });
    if (!targetOrigin?.segmentId) {
      notify("Não foi possível localizar o segmento original da máquina principal.", "danger");
      return false;
    }

    const maintenanceReady = await maintenanceEntry.ensureMachineInMaintenanceForServiceOrder(mainMachine, order);
    if (!maintenanceReady) return false;

    const backupOrigin = getRealBackupLocation(backupMachine, segmentLists);
    const targetSegment =
      findSegmentById(targetOrigin.segmentId, decoratedSegments, activeSegments, segments) ||
      getDefaultInventorySegment(segmentLists);

    if (!targetSegment) {
      notify("Não foi possível localizar o segmento de destino do Backup.", "danger");
      return false;
    }

    const moved = await moves.handleMoveMachine(backupMachine, targetSegment.id, {
      reason: "backup_in_use",
      targetTabId: targetOrigin.tabId || order.environmentId || activeInventoryTab.id,
      forceSingle: true,
      allowBackupMove: true
    });
    if (!moved) return false;

    try {
      const backupResponse = await updateDeviceBackup(token, backupMachine.id, {
        isBackup: true,
        status: "in_use",
        serviceOrderId: order.id,
        originalSegmentId: backupOrigin.segmentId,
        originalSegmentName: backupOrigin.segmentName
      });
      deviceState.upsertDeviceInState(backupResponse.device);

      const updatedOrder = await serviceOrderCore.handleUpdateServiceOrder(order.id, { backupAssetId: backupMachine.id });
      await serviceOrderCore.addServiceOrderSystemHistory(order.id, {
        eventType: "backup",
        message: "Backup selecionado e movido para o local da máquina principal.",
        oldValue: "",
        newValue: backupMachine.name
      });
      deviceState.appendDeviceHistoryEvent(mainMachine.id, buildBackupHistoryEvent({
        machineId: mainMachine.id,
        key: "backup-replacement",
        userName: user.name,
        message: `Substituída temporariamente por máquina Backup na OS #${order.number}.`,
        oldValue: mainMachine.name,
        newValue: backupMachine.name
      }));
      deviceState.appendDeviceHistoryEvent(backupMachine.id, buildBackupHistoryEvent({
        machineId: backupMachine.id,
        key: "backup-in-use",
        userName: user.name,
        message: `Usada como substituta na OS #${order.number}.`,
        oldValue: backupOrigin.segmentName,
        newValue: targetSegment.name
      }));
      await loadData(true);
      notify(`${backupMachine.name} alocada como Backup da OS ${updatedOrder?.number || order.number}.`, "ok");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  return { handleSelectBackupForServiceOrder };
}
