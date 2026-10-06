import { createServiceOrder } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { getSegmentGroupId } from "../../components/inventory/inventoryUtils.js";
import { isMaintenanceSegmentName } from "../../utils/display.js";
import {
  buildMaintenanceOrderPayload,
  buildMaintenanceRecord,
  hasOpenMaintenanceOrder,
  resolveServiceOrderTargetTabId,
  unorganizedLabel
} from "../inventory/maintenanceEntryModel.js";
import { useMaintenanceSegment } from "./useMaintenanceSegment.js";

// Coloca maquinas no segmento de manutencao (manualmente ou ao vincular a
// maquina a uma OS), registrando origem, historico e a OS de manutencao.
export function useMaintenanceEntry({ data, deviceState, exit, inventory, meta, moves, serviceOrderCore }) {
  const { token, notify, user } = useAppSession();
  const { model, persistence } = inventory;
  const { activeInventoryTab, activeSegmentGroups, activeSegments, decoratedSegmentGroups, decoratedSegments } = model;
  const { saveMaintenanceRecords } = persistence;
  const { serviceOrders, setServiceOrders } = data;
  const { getOrCreateMaintenanceSegment } = useMaintenanceSegment({ data, decoratedSegments, meta });

  // Grava o registro local de manutencao, atualiza o ativo na tela e lanca o
  // evento no historico do ativo.
  function registerMaintenanceEntry({ eventIdKey, machine, maintenanceRecord, maintenanceSegment, message, previousSegment }) {
    saveMaintenanceRecords((current) => ({
      ...current,
      [machine.id]: maintenanceRecord
    }));
    deviceState.updateDeviceSegmentInState(machine.id, maintenanceSegment.id, maintenanceSegment.name, {
      maintenance: true,
      maintenanceOrigin: maintenanceRecord.origin
    });
    deviceState.appendDeviceHistoryEvent(machine.id, {
      id: `${machine.id}-${eventIdKey}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      userName: user.name,
      eventType: "maintenance",
      message,
      oldValue: previousSegment,
      newValue: maintenanceSegment.name
    });
  }

  async function ensureMachineInMaintenanceForServiceOrder(machine, serviceOrder) {
    if (!machine || !serviceOrder?.id) return false;

    const orderLabel = serviceOrder.number ? `#${serviceOrder.number}` : "";

    if (machine.maintenance || isMaintenanceSegmentName(machine.segmentName)) {
      await serviceOrderCore.addServiceOrderSystemHistory(serviceOrder.id, {
        eventType: "maintenance",
        message: "Máquina vinculada. Ela já estava em manutenção.",
        newValue: machine.name
      });
      return true;
    }

    try {
      const targetTabId = resolveServiceOrderTargetTabId(machine, serviceOrder, activeInventoryTab);
      const originSegment = decoratedSegments.find((segment) => segment.id === machine.segmentId);
      const originGroupId = originSegment ? getSegmentGroupId(originSegment, decoratedSegmentGroups) : "";
      const maintenanceSegment = await getOrCreateMaintenanceSegment();
      const previousSegment = machine.segmentName || unorganizedLabel;
      const maintenanceRecord = buildMaintenanceRecord({
        tabId: targetTabId,
        groupId: originGroupId,
        segmentId: machine.segmentId,
        segmentName: previousSegment
      });

      const moved = await moves.handleMoveMachine(machine, maintenanceSegment.id, {
        reason: "maintenance",
        targetTabId,
        forceSingle: true
      });
      if (!moved) return false;

      registerMaintenanceEntry({
        eventIdKey: "service-order-maintenance",
        machine,
        maintenanceRecord,
        maintenanceSegment,
        message: `Máquina colocada em manutenção automaticamente pela OS ${orderLabel}.`,
        previousSegment
      });
      await serviceOrderCore.addServiceOrderSystemHistory(serviceOrder.id, {
        eventType: "maintenance",
        message: "Máquina vinculada e colocada em manutenção.",
        oldValue: previousSegment,
        newValue: maintenanceSegment.name
      });
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function putMachineInMaintenance(machine) {
    if (!machine) return false;

    try {
      if (machine.maintenance || isMaintenanceSegmentName(machine.segmentName)) {
        return exit.removeMachineFromMaintenance(machine);
      }

      const originSegment = activeSegments.find((segment) => segment.id === machine.segmentId);
      const originGroupId = originSegment ? getSegmentGroupId(originSegment, activeSegmentGroups) : "";
      const maintenanceSegment = await getOrCreateMaintenanceSegment();
      const previousSegment = machine.segmentName || unorganizedLabel;
      const maintenanceRecord = buildMaintenanceRecord({
        tabId: activeInventoryTab.id,
        groupId: originGroupId,
        segmentId: machine.segmentId,
        segmentName: previousSegment
      });

      const moved = await moves.handleMoveMachine(machine, maintenanceSegment.id, { reason: "maintenance" });
      if (!moved) return false;
      registerMaintenanceEntry({
        eventIdKey: "maintenance",
        machine,
        maintenanceRecord,
        maintenanceSegment,
        message: "Máquina colocada em manutenção",
        previousSegment
      });

      if (!hasOpenMaintenanceOrder(serviceOrders, machine.id)) {
        const response = await createServiceOrder(
          token,
          buildMaintenanceOrderPayload({ machine, activeInventoryTab, user, previousSegment })
        );

        setServiceOrders((current) => [response.serviceOrder, ...current]);
      }

      notify(`${machine.name} colocada em manutenção.`, "ok");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  return { ensureMachineInMaintenanceForServiceOrder, putMachineInMaintenance };
}
