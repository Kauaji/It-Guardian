import { useAppSession } from "../../context/AppSessionContext.jsx";
import { isMaintenanceSegmentName } from "../../utils/display.js";
import { findSegmentById } from "../inventory/inventoryModel.js";

export function maintenanceExitMessage({ hasServiceOrder, hasOriginSegment, serviceOrderLabel }) {
  if (hasServiceOrder) {
    return hasOriginSegment
      ? `Máquina retirada da manutenção automaticamente pela finalização da OS ${serviceOrderLabel}.`
      : `Máquina retirada da manutenção automaticamente pela finalização da OS ${serviceOrderLabel}, mas o segmento original não existe mais. Movida para Não organizadas.`;
  }
  return hasOriginSegment
    ? "Máquina retirada da manutenção"
    : "Máquina retirada da manutenção, mas o segmento original não existe mais. Movida para Não organizadas.";
}

// Retira uma maquina do segmento de manutencao, devolvendo-a ao segmento de
// origem (ou a "Nao organizadas" se ele nao existir mais).
export function useMaintenanceExit({ data, deviceState, inventory, moves }) {
  const { notify, user } = useAppSession();
  const { model, persistence } = inventory;
  const { activeInventoryTab, activeSegments, decoratedSegments } = model;
  const { maintenanceRecords, saveMaintenanceRecords } = persistence;
  const { segments } = data;

  async function removeMachineFromMaintenance(machine, options = {}) {
    if (!machine) return false;

    const serviceOrderLabel = options.serviceOrder?.number ? `#${options.serviceOrder.number}` : "";
    const record = maintenanceRecords[machine.id];
    const origin = record?.origin || machine.maintenanceOrigin;
    const fallbackSegment =
      activeSegments.find((segment) => segment.isDefault) ||
      decoratedSegments.find((segment) => segment.isDefault);
    const originSegment =
      origin?.segmentId &&
      !isMaintenanceSegmentName(origin.segmentName) &&
      findSegmentById(origin.segmentId, activeSegments, decoratedSegments, segments);
    const targetSegment = originSegment || fallbackSegment;

    if (!targetSegment) {
      notify("Não foi possível localizar o segmento de retorno.", "danger");
      return false;
    }

    const machineForMove = { ...machine, maintenance: true };
    const moved = await moves.handleMoveMachine(machineForMove, targetSegment.id, {
      reason: "maintenance_exit",
      targetTabId: origin?.tabId || machine.tabId || activeInventoryTab.id
    });
    if (!moved) return false;

    saveMaintenanceRecords((current) => {
      const next = { ...current };
      delete next[machine.id];
      return next;
    });
    deviceState.updateDeviceSegmentInState(machine.id, targetSegment.id, targetSegment.name, {
      maintenance: false,
      maintenanceOrigin: null
    });
    deviceState.appendDeviceHistoryEvent(machine.id, {
      id: `${machine.id}-maintenance-exit-${Date.now()}`,
      createdAt: new Date().toISOString(),
      userName: user.name,
      eventType: "maintenance",
      message: maintenanceExitMessage({
        hasServiceOrder: Boolean(options.serviceOrder),
        hasOriginSegment: Boolean(originSegment),
        serviceOrderLabel
      }),
      oldValue: machine.segmentName || "Manutenção",
      newValue: targetSegment.name
    });
    notify(`${machine.name} retirada da manutencao.`, "ok");
    return true;
  }

  return { removeMachineFromMaintenance };
}
