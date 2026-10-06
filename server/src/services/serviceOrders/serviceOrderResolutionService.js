import { generalSector, defaultServiceOrderSector } from "../../domain/serviceOrders/serviceOrderSector.js";
import { resolveConfiguredPriority } from "../../domain/serviceOrders/serviceOrderPriority.js";
import { hasServicePayload, hasSectorPayload } from "../../domain/serviceOrders/serviceOrderPayload.js";
import { normalizeText } from "../../domain/serviceOrders/serviceOrderText.js";
import {
  findActiveCatalogService,
  findActiveSectorById,
  findActiveSectorByName,
  listPriorityRules
} from "../../repositories/serviceOrders/serviceOrderLookupRepository.js";

/**
 * Resolve o setor da OS: mantem o atual quando o payload nao fala de setor,
 * procura por id e depois por nome entre os setores ativos e cai em "Geral".
 */
export async function resolveServiceOrderSector(payload = {}, current = null) {
  if (!hasSectorPayload(payload) && current) {
    return {
      sectorId: current.sectorId || generalSector.id,
      sectorName: current.sectorName || generalSector.name
    };
  }

  const requestedId = String(payload.sectorId || "").trim();
  const requestedName = String(payload.sectorName || "").trim();

  if (!requestedId && !requestedName) {
    return { ...defaultServiceOrderSector };
  }

  if (requestedId && requestedId !== generalSector.id) {
    const sector = await findActiveSectorById(requestedId);
    if (sector) return { sectorId: sector.id, sectorName: sector.name };
  }

  if (requestedName && normalizeText(requestedName) !== normalizeText(generalSector.name)) {
    const sector = await findActiveSectorByName(requestedName);
    if (sector) return { sectorId: sector.id, sectorName: sector.name };
  }

  return { ...defaultServiceOrderSector };
}

/**
 * Resolve o servico do catalogo (por id, codigo ou nome). Sem correspondencia,
 * preserva apenas o codigo/nome digitados; sem payload, mantem o da OS atual.
 */
export async function resolveServiceOrderService(payload = {}, current = null) {
  if (!hasServicePayload(payload) && current) {
    return {
      serviceId: current.serviceId || null,
      serviceCode: current.serviceCode || null,
      serviceName: current.serviceName || null,
      defaultPriority: null,
      defaultValue: null
    };
  }

  const requestedId = String(payload.serviceId || "").trim();
  const requestedCode = String(payload.serviceCode || "").trim();
  const requestedName = String(payload.serviceName || "").trim();

  if (!requestedId && !requestedCode && !requestedName) {
    return { serviceId: null, serviceCode: null, serviceName: null, defaultPriority: null, defaultValue: null };
  }

  const service = await findActiveCatalogService({
    id: requestedId,
    code: requestedCode,
    name: requestedName
  });
  if (!service) {
    return {
      serviceId: null,
      serviceCode: requestedCode || null,
      serviceName: requestedName || null,
      defaultPriority: null,
      defaultValue: null
    };
  }

  return {
    serviceId: service.id,
    serviceCode: service.code,
    serviceName: service.name,
    defaultPriority: service.default_priority,
    defaultValue: service.default_value
  };
}

export async function calculateConfiguredPriority(payload = {}, sector = generalSector, service = {}) {
  const rules = await listPriorityRules();
  return resolveConfiguredPriority(payload, sector, service, rules);
}
