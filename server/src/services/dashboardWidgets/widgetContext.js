import { listAlerts } from "../../repositories/alertRepository.js";
import { listLogs } from "../../repositories/logRepository.js";
import { listRecentScriptExecutionLogs } from "../../repositories/maintenanceScriptRepository.js";
import { getServiceOrderSettings, listServiceOrders } from "../../repositories/serviceOrderRepository.js";
import { getActiveAlertsWithAcknowledgements } from "../alertService.js";
import { listDevices } from "../monitoringService.js";
import { withDashboardFilters } from "./widgetFilters.js";

/**
 * Varios widgets recontam as mesmas listas (dispositivos, alertas, ordens de
 * servico) que /api/dashboard/summary ja fan-out para uma unica resposta.
 * Este contexto memoiza cada fonte compartilhada pela duracao de UMA
 * requisicao HTTP (nunca entre requisicoes, para nao servir dado velho) -
 * se 5 widgets pedirem listDevices() na mesma preview/layout render, so uma
 * consulta real acontece.
 */
export function createWidgetContext({ user, filters = {} } = {}) {
  const cache = new Map();

  function memo(key, loader) {
    if (!cache.has(key)) cache.set(key, loader());
    return cache.get(key);
  }

  return withDashboardFilters({
    getDevices: () => memo("devices", () => listDevices({})),
    getActiveAlerts: () => memo("activeAlerts", () => getActiveAlertsWithAcknowledgements()),
    getAllAlerts: () => memo("allAlerts", () => listAlerts({})),
    getServiceOrders: () => memo("serviceOrders", () => listServiceOrders(user)),
    getServiceOrderSettings: () => memo("serviceOrderSettings", () => getServiceOrderSettings()),
    getRecentEventLogs: () => memo("eventLogs", () => listLogs()),
    getRecentScriptExecutionLogs: (limit) => memo(`scriptLogs:${limit}`, () => listRecentScriptExecutionLogs({ limit }))
  }, filters);
}
