// Regras puras da entrada de máquinas em manutenção (registro de origem, OS aberta e payload da OS).
import { isMaintenanceServiceOrder } from "./serviceOrderRules.js";

export const unorganizedLabel = "Não organizadas";

/** Registro local de manutenção: guarda de onde a máquina veio para devolvê-la depois. */
export function buildMaintenanceRecord({ tabId, groupId, segmentId, segmentName }) {
  return {
    active: true,
    origin: { tabId, groupId, segmentId, segmentName }
  };
}

/** Aba de destino da OS: a da máquina, ou a do ambiente da OS / aba ativa para máquinas não organizadas. */
export function resolveServiceOrderTargetTabId(machine, serviceOrder, activeInventoryTab) {
  return machine.tabId && machine.tabId !== "global-unorganized" ? machine.tabId : serviceOrder.environmentId || activeInventoryTab.id;
}

export function hasOpenMaintenanceOrder(serviceOrders, assetId) {
  return serviceOrders.some((order) => order.assetId === assetId && isMaintenanceServiceOrder(order) && order.status !== "closed");
}

export function buildMaintenanceOrderPayload({ machine, activeInventoryTab, user, previousSegment }) {
  return {
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
  };
}
