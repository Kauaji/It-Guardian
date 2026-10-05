import { sumServiceOrderItems, toMoneyValue } from "./serviceOrderItems.js";
import { generalSector } from "./serviceOrderSector.js";

export function hasOwn(payload, key) {
  return Object.prototype.hasOwnProperty.call(payload || {}, key);
}

export function hasSectorPayload(payload = {}) {
  return hasOwn(payload, "sectorId") || hasOwn(payload, "sectorName");
}

export function hasItemsPayload(payload = {}) {
  return hasOwn(payload, "items") || hasOwn(payload, "serviceItems");
}

export function hasAssignedTechniciansPayload(payload = {}) {
  return hasOwn(payload, "assignedTechnicianNames") || hasOwn(payload, "assignedTechnicianName");
}

export function hasServicePayload(payload = {}) {
  return (
    Object.prototype.hasOwnProperty.call(payload, "serviceId") ||
    Object.prototype.hasOwnProperty.call(payload, "serviceCode") ||
    Object.prototype.hasOwnProperty.call(payload, "serviceName")
  );
}

export function resolveAssignedTechnicianNames(payload = {}, current = null) {
  const hasList = Object.prototype.hasOwnProperty.call(payload, "assignedTechnicianNames");
  const hasSingle = Object.prototype.hasOwnProperty.call(payload, "assignedTechnicianName");
  const source = hasList
    ? payload.assignedTechnicianNames
    : hasSingle
      ? [payload.assignedTechnicianName]
      : current?.assignedTechnicianNames || (current?.assignedTechnicianName ? [current.assignedTechnicianName] : []);
  return [...new Set((Array.isArray(source) ? source : []).map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 12);
}

/** Soma valor do servico e das pecas (arredondado em centavos). */
export function calculateServiceOrderTotals(serviceValue, items = []) {
  const totalPartsValue = sumServiceOrderItems(items);
  const totalValue = Math.round((serviceValue + totalPartsValue) * 100) / 100;
  return { serviceValue, totalPartsValue, totalValue };
}

export function resolveCreateServiceValue(payload = {}, service = {}) {
  return payload.serviceValue !== undefined
    ? toMoneyValue(payload.serviceValue)
    : toMoneyValue(service.defaultValue);
}

export function resolveUpdateServiceValue(payload = {}, current = {}, service = {}) {
  if (payload.serviceValue !== undefined) return toMoneyValue(payload.serviceValue);
  if (hasServicePayload(payload) && service.defaultValue != null) return toMoneyValue(service.defaultValue);
  return toMoneyValue(current.serviceValue);
}

/**
 * Lista de alteracoes comparaveis de uma atualizacao de OS:
 * [tipoDoEvento, mensagem, valorAntigo, valorNovo]. Um valor novo `undefined`
 * significa "campo nao enviado" e nao gera evento de historico.
 */
export function buildServiceOrderChanges({
  current,
  payload,
  assignedTechnicianNames,
  nextAssetId,
  serviceValue,
  sector,
  service,
  itemsInPayload
}) {
  return [
    ["title", "Título alterado.", current.title, payload.title],
    ["description", "Descrição alterada.", current.description, payload.description],
    ["status", "Status alterado.", current.status, payload.status],
    ["priority", "Prioridade alterada.", current.priority, payload.priority],
    ["category", "Categoria alterada.", current.category, payload.category],
    ["problem_type", "Tipo de problema alterado.", current.problemType, payload.problemType],
    ["assigned", "Técnicos responsáveis alterados.", (current.assignedTechnicianNames || []).join(", "), Object.prototype.hasOwnProperty.call(payload, "assignedTechnicianNames") ? assignedTechnicianNames.join(", ") : payload.assignedTechnicianName],
    ["asset", "Máquina vinculada à Ordem de Serviço.", current.assetId, Object.prototype.hasOwnProperty.call(payload, "assetId") ? nextAssetId : undefined],
    ["backup", "Máquina Backup vinculada à OS.", current.backupAssetId, payload.backupAssetId],
    ["environment", "Ambiente alterado.", current.environmentName, payload.environmentName],
    ["location", "Localização alterada.", current.location, payload.location],
    ["source", "Origem alterada.", current.source, payload.source],
    ["auto_priority", "Prioridade automática alterada.", current.autoPriorityEnabled, payload.autoPriorityEnabled],
    ["work_notes", "Notas de trabalho atualizadas.", current.workNotes, payload.workNotes],
    ["diagnosis", "Diagnóstico atualizado.", current.diagnosis, payload.diagnosis],
    ["solution", "Solução atualizada.", current.solution, payload.solution],
    ["notes", "Observações da OS atualizadas.", current.notes, payload.notes],
    ["service_performed", "Serviço realizado atualizado.", current.servicePerformed, payload.servicePerformed],
    ["attendance_notes", "Observações do atendimento atualizadas.", current.attendanceNotes, payload.attendanceNotes],
    ["service_value", "Valor do serviço alterado.", current.serviceValue, payload.serviceValue !== undefined ? serviceValue : undefined],
    ["sector", `Setor alterado de ${current.sectorName || generalSector.name} para ${sector.sectorName}.`, current.sectorName, sector.sectorName],
    ["service", "Serviço da OS alterado.", current.serviceName || current.serviceCode, service.serviceName || service.serviceCode],
    ["parts", "Peças trocadas registradas.", current.partsUsed, itemsInPayload ? undefined : payload.partsUsed]
  ].filter(([, , oldValue, newValue]) => newValue !== undefined && String(oldValue ?? "") !== String(newValue ?? ""));
}
