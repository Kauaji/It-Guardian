import { updateDeviceBackup } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { backupSegmentName } from "../../components/inventory/inventoryLocalState.js";
import { getDefaultInventorySegment, getRealBackupLocation } from "../inventory/segmentLookups.js";
import { buildBackupHistoryEvent } from "./backupHistory.js";

// Devolve a maquina Backup de uma OS a area de reserva.
export function useBackupRelease({ data, deviceState, inventory, moves, serviceOrderCore }) {
  const { token, notify, user } = useAppSession();
  const { activeInventoryTab, activeSegments, decoratedSegments, findDecoratedDevice } = inventory.model;
  const { loadData, segments } = data;
  const segmentLists = { activeSegments, decoratedSegments, segments };

  async function releaseBackupForServiceOrder(order, options = {}) {
    if (!order?.backupAssetId) return false;

    const backupMachine = findDecoratedDevice(order.backupAssetId);
    if (!backupMachine) {
      await serviceOrderCore.handleUpdateServiceOrder(order.id, { backupAssetId: null });
      return true;
    }

    const backupOrigin = getRealBackupLocation(backupMachine, segmentLists);
    const targetSegment = backupOrigin.segment || getDefaultInventorySegment(segmentLists);

    if (!targetSegment?.id) {
      notify("Não foi possível localizar o retorno do Backup.", "danger");
      return false;
    }

    const moved = backupMachine.segmentId === targetSegment.id
      ? true
      : await moves.handleMoveMachine(backupMachine, targetSegment.id, {
          reason: "backup_return",
          targetTabId: backupMachine.tabId || activeInventoryTab.id,
          forceSingle: true,
          allowBackupMove: true
        });
    if (!moved) return false;

    try {
      const backupResponse = await updateDeviceBackup(token, backupMachine.id, {
        isBackup: true,
        status: "available",
        serviceOrderId: null,
        originalSegmentId: targetSegment.id,
        originalSegmentName: targetSegment.name
      });
      deviceState.upsertDeviceInState(backupResponse.device);
      await serviceOrderCore.handleUpdateServiceOrder(order.id, { backupAssetId: null });
      await serviceOrderCore.addServiceOrderSystemHistory(order.id, {
        eventType: "backup",
        message: options.finalized
          ? "OS finalizada e máquina Backup devolvida para a área Backup."
          : "Máquina Backup devolvida para a área Backup.",
        oldValue: backupMachine.name,
        newValue: backupSegmentName
      });
      deviceState.appendDeviceHistoryEvent(backupMachine.id, buildBackupHistoryEvent({
        machineId: backupMachine.id,
        key: "backup-return",
        userName: user.name,
        message: `Devolvida para a área Backup pela OS #${order.number}.`,
        oldValue: backupMachine.segmentName,
        newValue: backupSegmentName
      }));
      await loadData(true);
      notify(`${backupMachine.name} devolvida para Backup.`, "ok");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  return { releaseBackupForServiceOrder };
}
