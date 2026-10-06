import { hasOwn } from "./serviceOrderPayload.js";

/** @import { ServiceOrder, ServiceOrderMoney, ServiceOrderPayload, ServiceOrderSector, ServiceOrderService, ServiceOrderSettings } from "./types.js" */

/**
 * Monta os valores persistidos de uma OS nova a partir do payload ja
 * validado e dos dados resolvidos (setor, servico, prioridade, totais).
 * Funcao pura: nao acessa banco.
 *
 * @param {object} input
 * @param {ServiceOrderPayload} input.payload
 * @param {string} input.id
 * @param {string} input.number
 * @param {ServiceOrderSettings} input.settings
 * @param {string} input.initialStatus
 * @param {string} input.priority
 * @param {ServiceOrderSector & { sectorId: string | null, sectorName: string | null }} input.sector
 * @param {ServiceOrderService} input.service
 * @param {ServiceOrderMoney} input.money
 * @param {string[]} input.assignedTechnicianNames
 * @param {{ id?: string | null } | null} [input.user]
 * @param {string | null} input.slaDueAt
 */
export function buildNewServiceOrderRow({
  payload,
  id,
  number,
  settings,
  initialStatus,
  priority,
  sector,
  service,
  money,
  assignedTechnicianNames,
  user,
  slaDueAt
}) {
  return {
    id,
    number,
    title: payload.title,
    description: payload.description || "",
    status: initialStatus,
    priority,
    category: payload.category || null,
    assetId: payload.assetId || null,
    problemType: payload.problemType || null,
    environmentId: payload.environmentId || null,
    environmentName: payload.environmentName || null,
    requesterName: payload.requesterName || null,
    contactInfo: payload.contactInfo || null,
    requesterDepartment: payload.requesterDepartment || null,
    requesterExtension: payload.requesterExtension || null,
    relatedAssetText: payload.relatedAssetText || null,
    machineScope: payload.machineScope || null,
    location: payload.location || null,
    source: payload.source || null,
    assignedTechnicianName: assignedTechnicianNames[0] || payload.assignedTechnicianName || null,
    autoPriorityEnabled: payload.autoPriorityEnabled ?? settings.autoPriority.enabled,
    notes: payload.notes || null,
    servicePerformed: payload.servicePerformed || null,
    attendanceNotes: payload.attendanceNotes || null,
    serviceValue: money.serviceValue,
    totalPartsValue: money.totalPartsValue,
    totalValue: money.totalValue,
    backupAssetId: payload.backupAssetId || null,
    sectorId: sector.sectorId,
    sectorName: sector.sectorName,
    serviceId: service.serviceId,
    serviceCode: service.serviceCode,
    serviceName: service.serviceName,
    preventivePlanId: payload.preventivePlanId || null,
    createdBy: user?.id || null,
    slaDueAt
  };
}

/**
 * Instante de fechamento: preserva o existente ao finalizar e zera ao reabrir.
 *
 * @param {{ nextStatus: string, finalStatus: string, current: Pick<ServiceOrder, "closedAt"> }} input
 * @returns {string | Date | null}
 */
export function resolveClosedAt({ nextStatus, finalStatus, current }) {
  return nextStatus === finalStatus ? current.closedAt || new Date().toISOString() : null;
}

/**
 * Valores da atualizacao de uma OS: cada campo enviado no payload substitui o
 * atual; campos ausentes preservam o valor existente (funcao pura).
 *
 * @param {object} input
 * @param {ServiceOrderPayload} input.payload
 * @param {ServiceOrder} input.current
 * @param {string} input.nextStatus
 * @param {string | Date | null} input.closedAt
 * @param {ServiceOrderSector} input.sector
 * @param {ServiceOrderService} input.service
 * @param {ServiceOrderMoney} input.money
 * @param {string[]} input.assignedTechnicianNames
 */
export function buildUpdatedServiceOrderRow({
  payload,
  current,
  nextStatus,
  closedAt,
  sector,
  service,
  money,
  assignedTechnicianNames
}) {
  return {
    title: payload.title ?? current.title,
    description: payload.description ?? current.description,
    status: nextStatus,
    priority: payload.priority ?? current.priority,
    category: payload.category ?? current.category,
    assetId: hasOwn(payload, "assetId") ? payload.assetId || null : current.assetId,
    problemType: payload.problemType ?? current.problemType,
    environmentId: payload.environmentId ?? current.environmentId,
    environmentName: payload.environmentName ?? current.environmentName,
    requesterName: payload.requesterName ?? current.requesterName,
    contactInfo: payload.contactInfo ?? current.contactInfo,
    requesterDepartment: payload.requesterDepartment ?? current.requesterDepartment,
    requesterExtension: payload.requesterExtension ?? current.requesterExtension,
    relatedAssetText: payload.relatedAssetText ?? current.relatedAssetText,
    machineScope: payload.machineScope ?? current.machineScope,
    location: payload.location ?? current.location,
    source: payload.source ?? current.source,
    assignedTechnicianName: assignedTechnicianNames[0] || null,
    autoPriorityEnabled: payload.autoPriorityEnabled ?? current.autoPriorityEnabled,
    workNotes: payload.workNotes ?? current.workNotes,
    diagnosis: payload.diagnosis ?? current.diagnosis,
    solution: payload.solution ?? current.solution,
    partsUsed: payload.partsUsed ?? current.partsUsed,
    notes: payload.notes ?? current.notes,
    closedAt,
    serviceValue: money.serviceValue,
    totalPartsValue: money.totalPartsValue,
    totalValue: money.totalValue,
    backupAssetId: hasOwn(payload, "backupAssetId") ? payload.backupAssetId : current.backupAssetId,
    servicePerformed: payload.servicePerformed ?? current.servicePerformed,
    attendanceNotes: payload.attendanceNotes ?? current.attendanceNotes,
    sectorId: sector.sectorId,
    sectorName: sector.sectorName,
    serviceId: service.serviceId,
    serviceCode: service.serviceCode,
    serviceName: service.serviceName
  };
}
