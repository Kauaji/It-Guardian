import { createSegment, createServiceOrder } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { getSegmentGroupId, upsertSegmentList } from "../../components/inventory/inventoryUtils.js";
import { isMaintenanceSegmentName } from "../../utils/display.js";
import { isMaintenanceServiceOrder } from "../inventory/serviceOrderRules.js";

const unorganizedLabel = "Não organizadas";

// Coloca maquinas no segmento de manutencao (manualmente ou ao vincular a
// maquina a uma OS), registrando origem, historico e a OS de manutencao.
export function useMaintenanceEntry({ data, deviceState, exit, inventory, meta, moves, serviceOrderCore }) {
  const { token, notify, user } = useAppSession();
  const { model, persistence } = inventory;
  const { activeInventoryTab, activeSegmentGroups, activeSegments, decoratedSegmentGroups, decoratedSegments } = model;
  const { saveMaintenanceRecords } = persistence;
  const { serviceOrders, setSegments, setServiceOrders } = data;

  async function getOrCreateMaintenanceSegment() {
    const existingActive = decoratedSegments.find(
      (segment) => !segment.isDefault && isMaintenanceSegmentName(segment.name)
    );
    if (existingActive) return existingActive;

    const response = await createSegment(token, {
      name: "Manutenção",
      color: "#f59e0b",
      groupId: null,
      systemSegment: "maintenance"
    });
    const nextSegment = { ...response.segment, groupId: null };

    setSegments((current) => upsertSegmentList(current, nextSegment));
    meta.updateInventoryMeta("segments", response.segment.id, {
      tabId: "shared",
      order: -1
    });

    return nextSegment;
  }

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
      const targetTabId =
        machine.tabId && machine.tabId !== "global-unorganized"
          ? machine.tabId
          : serviceOrder.environmentId || activeInventoryTab.id;
      const originSegment = decoratedSegments.find((segment) => segment.id === machine.segmentId);
      const originGroupId = originSegment ? getSegmentGroupId(originSegment, decoratedSegmentGroups) : "";
      const maintenanceSegment = await getOrCreateMaintenanceSegment();
      const previousSegment = machine.segmentName || unorganizedLabel;
      const maintenanceRecord = {
        active: true,
        origin: {
          tabId: targetTabId,
          groupId: originGroupId,
          segmentId: machine.segmentId,
          segmentName: previousSegment
        }
      };

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
      const maintenanceRecord = {
        active: true,
        origin: {
          tabId: activeInventoryTab.id,
          groupId: originGroupId,
          segmentId: machine.segmentId,
          segmentName: previousSegment
        }
      };

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

      const hasOpenMaintenanceOrder = serviceOrders.some(
        (order) =>
          order.assetId === machine.id &&
          isMaintenanceServiceOrder(order) &&
          order.status !== "closed"
      );

      if (!hasOpenMaintenanceOrder) {
        const response = await createServiceOrder(token, {
          title: `Manutenção - ${machine.name}`,
          description: `Máquina ${machine.name} colocada em manutenção. Preencha o diagnóstico, atendimento e solução antes de finalizar.`,
          priority: "medium",
          category: "Manutenção",
          assetId: machine.id,
          environmentId: activeInventoryTab.id,
          environmentName: activeInventoryTab.name || "Novo ambiente",
          requesterName: user.name,
          assignedTechnicianName: "",
          notes: `Origem: ${previousSegment}`
        });

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
