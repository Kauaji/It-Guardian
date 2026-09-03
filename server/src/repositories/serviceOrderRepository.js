import { randomUUID } from "node:crypto";
import { query } from "../database.js";
import { hasPermission } from "../permissions.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import { listSettingsRecords } from "./settingsRepository.js";

export const serviceOrderPriorities = new Set(["low", "medium", "high", "critical"]);

const serviceOrderSettingsKey = "service_orders";
const serviceOrderSettingsRowId = "default";
const serviceOrderNumberDigits = 4;
const generalSector = { id: "sector-geral", name: "Geral" };
const defaultServiceOrderSector = {
  sectorId: generalSector.id,
  sectorName: generalSector.name
};
export const maxServiceOrderStatuses = 10;
const defaultPriorityColors = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#ea580c",
  critical: "#dc2626"
};
export const defaultServiceOrderStatuses = [
  { id: "open", name: "Aberta", color: "#2563eb", order: 0, isInitial: true, isFinal: false },
  { id: "in_progress", name: "Em atendimento", color: "#d97706", order: 1, isInitial: false, isFinal: false },
  { id: "waiting", name: "Aguardando", color: "#7c3aed", order: 2, isInitial: false, isFinal: false },
  { id: "closed", name: "Finalizada", color: "#16a34a", order: 3, isInitial: false, isFinal: true }
];

const defaultSlaSettings = {
  low: 72,
  medium: 48,
  high: 24,
  critical: 4,
  nearDuePercent: 20,
  nearDueMinHours: 2
};

const defaultServiceOrderSettings = {
  numberFormat: {
    prefix: "OS",
    useYear: false,
    useMonth: false,
    nextNumber: null
  },
  autoPriority: {
    enabled: false,
    lowToMediumHours: 24,
    mediumToHighHours: 48,
    highToCriticalHours: 72
  },
  statuses: defaultServiceOrderStatuses,
  priorityColors: defaultPriorityColors,
  boardLayout: "horizontal",
  sla: defaultSlaSettings,
  requireChecklistBeforeFinish: false
};

function mergeServiceOrderSettings(value = {}) {
  return {
    numberFormat: {
      ...defaultServiceOrderSettings.numberFormat,
      ...(value.numberFormat || {})
    },
    autoPriority: {
      ...defaultServiceOrderSettings.autoPriority,
      ...(value.autoPriority || {})
    },
    statuses: value.statuses || defaultServiceOrderSettings.statuses,
    priorityColors: {
      ...defaultServiceOrderSettings.priorityColors,
      ...(value.priorityColors || {})
    },
    boardLayout: value.boardLayout || defaultServiceOrderSettings.boardLayout,
    sla: {
      ...defaultSlaSettings,
      ...(value.sla || {})
    },
    requireChecklistBeforeFinish: Boolean(value.requireChecklistBeforeFinish)
  };
}

function slugifyStatusId(value, fallback) {
  const id = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return id || fallback;
}

function sanitizeStatusColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
}

function normalizeStatus(status = {}, index = 0) {
  const fallback = defaultServiceOrderStatuses[index] || {
    id: `status_${index + 1}`,
    name: `Status ${index + 1}`,
    color: "#64748b",
    order: index
  };
  const name = String(status.name || status.label || fallback.name)
    .trim()
    .slice(0, 60) || fallback.name;
  const id = slugifyStatusId(status.id || status.value || name, fallback.id);
  const order = Number(status.order);

  return {
    id,
    name,
    color: sanitizeStatusColor(status.color, fallback.color || "#64748b"),
    order: Number.isFinite(order) ? Math.trunc(order) : index,
    isInitial: Boolean(status.isInitial),
    isFinal: Boolean(status.isFinal)
  };
}

function normalizeStatuses(statuses = []) {
  const source = (Array.isArray(statuses) && statuses.length ? statuses : defaultServiceOrderStatuses)
    .slice(0, maxServiceOrderStatuses);
  const seen = new Set();
  const normalized = [];

  source.forEach((status, index) => {
    const next = normalizeStatus(status, index);
    if (seen.has(next.id)) return;
    seen.add(next.id);
    normalized.push(next);
  });

  for (const fallback of defaultServiceOrderStatuses) {
    if (normalized.length >= 2) break;
    if (!seen.has(fallback.id)) {
      normalized.push({ ...fallback });
      seen.add(fallback.id);
    }
  }

  normalized.sort((a, b) => a.order - b.order);

  const preferredInitial =
    normalized.findIndex((status) => status.isInitial) >= 0
      ? normalized.findIndex((status) => status.isInitial)
      : Math.max(0, normalized.findIndex((status) => status.id === "open"));
  let initialIndex = preferredInitial >= 0 ? preferredInitial : 0;
  const preferredFinal =
    normalized.findIndex((status) => status.isFinal) >= 0
      ? normalized.findIndex((status) => status.isFinal)
      : normalized.findIndex((status) => status.id === "closed");
  let finalIndex = preferredFinal >= 0 ? preferredFinal : normalized.length - 1;

  if (normalized.length > 1 && finalIndex === initialIndex) {
    const closedIndex = normalized.findIndex((status, index) => index !== initialIndex && status.id === "closed");
    finalIndex = closedIndex >= 0 ? closedIndex : normalized.findIndex((_status, index) => index !== initialIndex);
  }

  return normalized.map((status, index) => ({
    ...status,
    order: index,
    isInitial: index === initialIndex,
    isFinal: index === finalIndex
  }));
}

function normalizeServiceOrderSettings(value = {}) {
  const merged = mergeServiceOrderSettings(value);
  const nextNumber = Number(merged.numberFormat.nextNumber);
  const boardLayout = merged.boardLayout === "vertical" ? "vertical" : "horizontal";

  return {
    numberFormat: {
      prefix: String(merged.numberFormat.prefix || "OS").trim().toUpperCase().slice(0, 12) || "OS",
      useYear: Boolean(merged.numberFormat.useYear),
      useMonth: Boolean(merged.numberFormat.useMonth),
      nextNumber: Number.isFinite(nextNumber) && nextNumber > 0 ? Math.trunc(nextNumber) : null
    },
    autoPriority: {
      enabled: Boolean(merged.autoPriority.enabled),
      lowToMediumHours: Math.max(1, Number(merged.autoPriority.lowToMediumHours) || 24),
      mediumToHighHours: Math.max(1, Number(merged.autoPriority.mediumToHighHours) || 48),
      highToCriticalHours: Math.max(1, Number(merged.autoPriority.highToCriticalHours) || 72)
    },
    statuses: normalizeStatuses(merged.statuses),
    priorityColors: Object.fromEntries(
      Object.entries(defaultPriorityColors).map(([priority, fallback]) => [
        priority,
        sanitizeStatusColor(merged.priorityColors?.[priority], fallback)
      ])
    ),
    boardLayout,
    sla: {
      low: Math.max(0, Number(merged.sla.low) || 0) || defaultSlaSettings.low,
      medium: Math.max(0, Number(merged.sla.medium) || 0) || defaultSlaSettings.medium,
      high: Math.max(0, Number(merged.sla.high) || 0) || defaultSlaSettings.high,
      critical: Math.max(0, Number(merged.sla.critical) || 0) || defaultSlaSettings.critical,
      nearDuePercent: Math.min(90, Math.max(1, Number(merged.sla.nearDuePercent) || defaultSlaSettings.nearDuePercent)),
      nearDueMinHours: Math.max(0, Number(merged.sla.nearDueMinHours) || defaultSlaSettings.nearDueMinHours)
    },
    requireChecklistBeforeFinish: merged.requireChecklistBeforeFinish
  };
}

export function formatServiceOrderNumber(sequence, settings = defaultServiceOrderSettings) {
  const { prefix, useYear, useMonth } = normalizeServiceOrderSettings(settings).numberFormat;
  const padded = String(sequence).padStart(serviceOrderNumberDigits, "0");
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return [prefix, useYear ? year : "", useMonth ? month : "", padded].filter(Boolean).join("-");
}

let serviceOrderNumberQueue = Promise.resolve();

async function withServiceOrderNumberLock(operation) {
  const previous = serviceOrderNumberQueue;
  let release = () => {};
  serviceOrderNumberQueue = new Promise((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await operation();
  } finally {
    release();
  }
}

const priorityRank = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

function toMoneyValue(value) {
  if (value == null || value === "") return 0;
  const raw = String(value).replace(/[^\d,.-]/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function isGeneralSector({ sectorId, sectorName } = {}) {
  return !sectorId || sectorId === generalSector.id || normalizeText(sectorName) === normalizeText(generalSector.name);
}

export function canViewAllServiceOrders(user = {}) {
  return hasPermission(user, "service_orders.view_all") || hasPermission(user, "admin.full");
}

export function canViewServiceOrder(user = {}, order = {}) {
  if (!user?.id) return false;
  if (canViewAllServiceOrders(user)) return true;
  if (Array.isArray(user.allowedClientIds) && user.allowedClientIds.length && order.environmentId) {
    return user.allowedClientIds.includes(order.environmentId);
  }
  if (isGeneralSector(order)) return true;
  if (order.createdBy && order.createdBy === user.id) return true;
  if (order.sectorId && user.sectorId && order.sectorId === user.sectorId) return true;
  if (normalizeText(order.sectorName) && normalizeText(order.sectorName) === normalizeText(user.sectorName)) return true;
  const assignedNames = order.assignedTechnicianNames?.length
    ? order.assignedTechnicianNames
    : order.assignedTechnicianName
      ? [order.assignedTechnicianName]
      : [];
  if (
    assignedNames.some((name) => (
      normalizeText(name) === normalizeText(user.name) ||
      normalizeText(name) === normalizeText(user.email)
    ))
  ) {
    return true;
  }
  return false;
}

async function resolveServiceOrderSector(payload = {}, current = null) {
  const hasSectorPayload =
    Object.prototype.hasOwnProperty.call(payload, "sectorId") ||
    Object.prototype.hasOwnProperty.call(payload, "sectorName");

  if (!hasSectorPayload && current) {
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
    const result = await query(
      "SELECT id, name FROM sectors WHERE id = $1 AND active = TRUE LIMIT 1",
      [requestedId]
    );
    if (result.rows[0]) {
      return { sectorId: result.rows[0].id, sectorName: result.rows[0].name };
    }
  }

  if (requestedName && normalizeText(requestedName) !== normalizeText(generalSector.name)) {
    const result = await query(
      "SELECT id, name FROM sectors WHERE LOWER(name) = LOWER($1) AND active = TRUE LIMIT 1",
      [requestedName]
    );
    if (result.rows[0]) {
      return { sectorId: result.rows[0].id, sectorName: result.rows[0].name };
    }
  }

  return { ...defaultServiceOrderSector };
}

function sanitizePriority(value, fallback = "medium") {
  return serviceOrderPriorities.has(value) ? value : fallback;
}

async function resolveServiceOrderService(payload = {}, current = null) {
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

  const clauses = [];
  const values = [];
  if (requestedId) {
    values.push(requestedId);
    clauses.push(`id = $${values.length}`);
  }
  if (requestedCode) {
    values.push(requestedCode);
    clauses.push(`LOWER(code) = LOWER($${values.length})`);
  }
  if (requestedName) {
    values.push(requestedName);
    clauses.push(`LOWER(name) = LOWER($${values.length})`);
  }

  const result = await query(
    `
      SELECT id, code, name, default_priority, default_value
      FROM service_catalog
      WHERE active = TRUE
        AND (${clauses.join(" OR ")})
      LIMIT 1
    `,
    values
  );

  const service = result.rows[0];
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

function hasServicePayload(payload = {}) {
  return (
    Object.prototype.hasOwnProperty.call(payload, "serviceId") ||
    Object.prototype.hasOwnProperty.call(payload, "serviceCode") ||
    Object.prototype.hasOwnProperty.call(payload, "serviceName")
  );
}

function chooseHigherPriority(current, candidate) {
  if (!serviceOrderPriorities.has(candidate)) return current;
  return priorityRank[candidate] > priorityRank[current] ? candidate : current;
}

async function calculateConfiguredPriority(payload = {}, sector = generalSector, service = {}) {
  let priority = sanitizePriority(payload.priority, sanitizePriority(service.defaultPriority, "medium"));
  const rules = await listSettingsRecords("priorityRules");
  const targets = {
    client: payload.environmentName,
    sector: sector.sectorName,
    problem_type: payload.problemType,
    service: service.serviceCode || service.serviceName || payload.serviceName,
    category: payload.category,
    equipment_category: payload.category
  };

  for (const rule of rules.filter((item) => item.active !== false)) {
    const target = normalizeText(rule.targetValue);
    if (!target || !targets[rule.ruleType]) continue;
    if (normalizeText(targets[rule.ruleType]) === target) {
      priority = chooseHigherPriority(priority, rule.priority);
    }
  }

  return priority;
}

function toQuantityValue(value) {
  const quantity = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0) return 1;
  return Math.round(quantity * 100) / 100;
}

function normalizeServiceOrderItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const quantity = toQuantityValue(item.quantity);
      const unitPrice = toMoneyValue(item.unitPrice ?? item.unit_price);
      return {
        id: item.id || randomUUID(),
        productId: item.productId || item.product_id || null,
        productName: String(item.productName || item.product_name || item.name || "").trim(),
        quantity,
        unitPrice,
        subtotal: Math.round(quantity * unitPrice * 100) / 100,
        notes: String(item.notes || "").trim()
      };
    })
    .filter((item) => item.productName);
}

function sumServiceOrderItems(items = []) {
  return Math.round(items.reduce((total, item) => total + toMoneyValue(item.subtotal), 0) * 100) / 100;
}

function itemsSignature(items = []) {
  return JSON.stringify(
    normalizeServiceOrderItems(items).map((item) => ({
      productId: item.productId || "",
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      notes: item.notes || ""
    }))
  );
}

function formatItemsForHistory(items = []) {
  const normalized = normalizeServiceOrderItems(items);
  if (!normalized.length) return "";
  return normalized
    .map((item) => `${item.productName} x${item.quantity} - R$ ${item.subtotal.toFixed(2).replace(".", ",")}`)
    .join("\n");
}

export function getInitialStatus(settings = defaultServiceOrderSettings) {
  return normalizeServiceOrderSettings(settings).statuses.find((status) => status.isInitial)
    || defaultServiceOrderStatuses[0];
}

export function getFinalStatus(settings = defaultServiceOrderSettings) {
  return normalizeServiceOrderSettings(settings).statuses.find((status) => status.isFinal)
    || defaultServiceOrderStatuses.at(-1);
}

export function hasServiceOrderStatus(settings, statusId) {
  return normalizeServiceOrderSettings(settings).statuses.some((status) => status.id === statusId);
}

export const SLA_STATUSES = {
  ON_TRACK: "on_track",
  NEAR_DUE: "near_due",
  BREACHED: "breached",
  PAUSED: "paused",
  RESOLVED: "resolved",
  NOT_APPLICABLE: "not_applicable"
};

function slaPriorityHours(settings, priority) {
  const hours = Number(settings?.sla?.[priority]);
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}

// Calcula o prazo de SLA uma unica vez, no momento em que ha um "inicio"
// valido (criacao da OS, ou reescala de prioridade automatica) -- nunca
// recalculado so por causa de leitura.
export function computeServiceOrderSlaDueAt(priority, settings, startAt) {
  const hours = slaPriorityHours(settings, priority);
  const start = new Date(startAt).getTime();
  if (!hours || !Number.isFinite(start)) return null;
  return new Date(start + hours * 60 * 60 * 1000).toISOString();
}

/**
 * Funcao pura: status de SLA (on_track/near_due/breached/resolved/
 * not_applicable) e minutos restantes, sempre computados na leitura a
 * partir de `slaDueAt` (persistido) - mesmo principio de
 * `withDisplayPriority`, nunca grava nada. `slaBreachedAt` (persistido
 * so por `syncSlaBreaches`) e o unico sinal que vira evento discreto de
 * historico; aqui ele so afeta o status retornado, nao e alterado.
 */
export function calculateServiceOrderSla(order, settings, now = new Date()) {
  const empty = { dueAt: null, status: SLA_STATUSES.NOT_APPLICABLE, remainingMinutes: null, breached: false, nearDue: false };
  if (!order?.slaDueAt) return empty;

  const dueAt = order.slaDueAt;
  const dueMs = new Date(dueAt).getTime();
  if (!Number.isFinite(dueMs)) return empty;

  const finalStatusId = getFinalStatus(settings).id;
  const isFinal = order.status === finalStatusId;

  if (isFinal) {
    const closedMs = order.closedAt ? new Date(order.closedAt).getTime() : null;
    const resolvedLate = Boolean(order.slaBreachedAt) || (Number.isFinite(closedMs) && closedMs > dueMs);
    return {
      dueAt,
      status: resolvedLate ? SLA_STATUSES.BREACHED : SLA_STATUSES.RESOLVED,
      remainingMinutes: null,
      breached: resolvedLate,
      nearDue: false
    };
  }

  const nowMs = now.getTime();
  const remainingMinutes = Math.round((dueMs - nowMs) / 60000);
  const breached = Boolean(order.slaBreachedAt) || remainingMinutes <= 0;

  if (breached) {
    return { dueAt, status: SLA_STATUSES.BREACHED, remainingMinutes: Math.min(remainingMinutes, 0), breached: true, nearDue: false };
  }

  const totalHours = slaPriorityHours(settings, order.priority);
  const totalMinutes = totalHours ? totalHours * 60 : null;
  const nearDuePercent = settings?.sla?.nearDuePercent ?? defaultSlaSettings.nearDuePercent;
  const nearDueMinHours = settings?.sla?.nearDueMinHours ?? defaultSlaSettings.nearDueMinHours;

  const percentRule = Boolean(totalMinutes) && remainingMinutes <= totalMinutes * (nearDuePercent / 100);
  const hoursRule =
    (order.priority === "high" || order.priority === "critical") && remainingMinutes <= nearDueMinHours * 60;
  const nearDue = percentRule || hoursRule;

  return { dueAt, status: nearDue ? SLA_STATUSES.NEAR_DUE : SLA_STATUSES.ON_TRACK, remainingMinutes, breached: false, nearDue };
}

function getTimedPriority(row, settings) {
  if (!settings.autoPriority.enabled || !row.auto_priority_enabled || row.status === getFinalStatus(settings).id) {
    return row.priority;
  }

  const createdAt = new Date(row.created_at).getTime();
  const openHours = (Date.now() - createdAt) / 36e5;
  let target = row.priority;

  if (openHours >= settings.autoPriority.highToCriticalHours) target = "critical";
  else if (openHours >= settings.autoPriority.mediumToHighHours) target = "high";
  else if (openHours >= settings.autoPriority.lowToMediumHours) target = "medium";

  return priorityRank[target] > priorityRank[row.priority] ? target : row.priority;
}

/**
 * Aplica a prioridade calculada por tempo apenas para exibicao, sem gravar
 * no banco. Uma simples listagem/leitura de OS nao deve ter efeito colateral
 * de escrita -- a persistencia real acontece em `persistAutoPriority`,
 * chamada apenas pelo job agendado (`syncAutoPriorities`).
 */
function withDisplayPriority(row, settings) {
  const nextPriority = getTimedPriority(row, settings);
  return nextPriority === row.priority ? row : { ...row, priority: nextPriority };
}

async function persistAutoPriority(row, settings) {
  const nextPriority = getTimedPriority(row, settings);
  if (nextPriority === row.priority) return row;

  // Se a OS ja tinha um prazo de SLA calculado, recalcula com a prioridade
  // nova (mesmo inicio - created_at) - sem isso, uma OS escalada de baixa
  // pra critica manteria um prazo de 72h calculado quando ainda era baixa.
  const nextSlaDueAt = row.sla_due_at
    ? computeServiceOrderSlaDueAt(nextPriority, settings, row.created_at)
    : row.sla_due_at;

  const result = await query(
    `
      UPDATE service_orders
      SET priority = $2, sla_due_at = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [row.id, nextPriority, nextSlaDueAt]
  );

  await addServiceOrderHistory({
    serviceOrderId: row.id,
    eventType: "auto_priority",
    message: "Prioridade automatica alterada por tempo.",
    oldValue: row.priority,
    newValue: nextPriority,
    user: { name: "Sistema" }
  });
  await addServiceOrderAssetHistory({
    assetId: row.asset_id,
    serviceOrder: row,
    eventType: "auto_priority",
    message: "Prioridade automática alterada por tempo.",
    oldValue: row.priority,
    newValue: nextPriority,
    user: { name: "Sistema" }
  });

  return result.rows[0] || row;
}

/**
 * Persiste a prioridade automatica de todas as OS elegiveis de uma vez --
 * chamada exclusivamente pelo job diario agendado
 * (`processScheduledMaintenanceTasks`), nunca por um caminho de leitura.
 */
export async function syncAutoPriorities() {
  const settings = await getServiceOrderSettings();
  if (!settings.autoPriority.enabled) return { checked: 0, updated: 0 };

  const finalStatusId = getFinalStatus(settings).id;
  const result = await query(
    `
      SELECT *
      FROM service_orders
      WHERE auto_priority_enabled = true
        AND status != $1
    `,
    [finalStatusId]
  );

  let updated = 0;
  for (const row of result.rows) {
    const before = row.priority;
    const after = await persistAutoPriority(row, settings);
    if (after.priority !== before) updated += 1;
  }

  return { checked: result.rows.length, updated };
}

/**
 * Marca `sla_breached_at` uma unica vez por OS (guardado por IS NULL) --
 * mesmo padrao de `syncAutoPriorities`: so roda pelo job agendado, nunca
 * por leitura. E o unico jeito de "SLA vencido" virar um evento discreto
 * no historico/Prontuario Tecnico, em vez de recomputado a cada leitura.
 */
export async function syncSlaBreaches() {
  const settings = await getServiceOrderSettings();
  const finalStatusId = getFinalStatus(settings).id;

  const result = await query(
    `
      SELECT *
      FROM service_orders
      WHERE sla_due_at < NOW()
        AND sla_breached_at IS NULL
        AND status != $1
    `,
    [finalStatusId]
  );

  let breached = 0;
  for (const row of result.rows) {
    const updated = await query(
      `
        UPDATE service_orders
        SET sla_breached_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND sla_breached_at IS NULL
        RETURNING *
      `,
      [row.id]
    );
    if (!updated.rows[0]) continue;
    breached += 1;

    await addServiceOrderHistory({
      serviceOrderId: row.id,
      eventType: "sla_breached",
      message: "SLA da ordem de servico vencido.",
      oldValue: null,
      newValue: row.sla_due_at,
      user: { name: "Sistema" }
    });
    await addServiceOrderAssetHistory({
      assetId: row.asset_id,
      serviceOrder: row,
      eventType: "sla_breached",
      message: "SLA vencido.",
      oldValue: null,
      newValue: row.sla_due_at,
      user: { name: "Sistema" }
    });
  }

  return { checked: result.rows.length, breached };
}

// Guardado por IS NULL - so grava na primeira vez que a OS recebe algum
// tipo de resposta apos a criacao (tecnico atribuido, status sai do
// inicial, ou atendimento registrado). Chamado explicitamente pelos 3
// pontos certos em serviceOrderService.js, nunca pelo PATCH generico.
export async function setFirstResponseAtIfNeeded(id) {
  await query(
    "UPDATE service_orders SET first_response_at = NOW() WHERE id = $1 AND first_response_at IS NULL",
    [id]
  );
}

function fromItemRow(row) {
  return {
    id: row.id,
    serviceOrderId: row.service_order_id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: Number(row.quantity || 0),
    unitPrice: Number(row.unit_price || 0),
    subtotal: Number(row.subtotal || 0),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromOrderRow(row, history = [], items = [], settings = null, feedback = null) {
  const order = {
    id: row.id,
    isDemo: String(row.id || "").startsWith("demo-os-"),
    number: row.number,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    category: row.category,
    problemType: row.problem_type,
    assetId: row.asset_id,
    backupAssetId: row.backup_asset_id,
    environmentId: row.environment_id,
    environmentName: row.environment_name,
    sectorId: row.sector_id || generalSector.id,
    sectorName: row.sector_name || generalSector.name,
    serviceId: row.service_id,
    serviceCode: row.service_code,
    serviceName: row.service_name,
    preventivePlanId: row.preventive_plan_id,
    requesterName: row.requester_name,
    contactInfo: row.contact_info,
    requesterDepartment: row.requester_department,
    requesterExtension: row.requester_extension,
    relatedAssetText: row.related_asset_text,
    machineScope: row.machine_scope,
    location: row.location,
    source: row.source,
    assignedTechnicianName: row.assigned_technician_name,
    assignedTechnicianNames: (() => {
      const names = parseJsonArray(row.assigned_technician_names);
      return names.length ? names : row.assigned_technician_name ? [row.assigned_technician_name] : [];
    })(),
    autoPriorityEnabled: row.auto_priority_enabled,
    workNotes: row.work_notes,
    diagnosis: row.diagnosis,
    solution: row.solution,
    servicePerformed: row.service_performed,
    attendanceNotes: row.attendance_notes,
    partsUsed: row.parts_used,
    serviceValue: Number(row.service_value || 0),
    totalPartsValue: Number(row.total_parts_value || 0),
    totalValue: Number(row.total_value || 0),
    items,
    serviceItems: items,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    slaDueAt: row.sla_due_at,
    firstResponseAt: row.first_response_at,
    slaBreachedAt: row.sla_breached_at,
    reopenedAt: row.reopened_at,
    reopenedBy: row.reopened_by,
    reopenReason: row.reopen_reason,
    reopenCount: Number(row.reopen_count || 0),
    feedback,
    history
  };
  if (settings) order.sla = calculateServiceOrderSla(order, settings);
  return order;
}

function fromHistoryRow(row) {
  return {
    id: row.id,
    serviceOrderId: row.service_order_id,
    eventType: row.event_type,
    message: row.message,
    oldValue: row.old_value,
    newValue: row.new_value,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at
  };
}

function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function resolveAssignedTechnicianNames(payload = {}, current = null) {
  const hasList = Object.prototype.hasOwnProperty.call(payload, "assignedTechnicianNames");
  const hasSingle = Object.prototype.hasOwnProperty.call(payload, "assignedTechnicianName");
  const source = hasList
    ? payload.assignedTechnicianNames
    : hasSingle
      ? [payload.assignedTechnicianName]
      : current?.assignedTechnicianNames || (current?.assignedTechnicianName ? [current.assignedTechnicianName] : []);
  return [...new Set((Array.isArray(source) ? source : []).map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 12);
}

function settingsFromDedicatedRow(row, statuses = []) {
  if (!row) return null;

  return normalizeServiceOrderSettings({
    numberFormat: {
      prefix: row.number_prefix,
      useYear: row.use_year,
      useMonth: row.use_month,
      nextNumber: row.next_number
    },
    autoPriority: {
      enabled: row.auto_priority_enabled,
      lowToMediumHours: row.low_to_medium_hours,
      mediumToHighHours: row.medium_to_high_hours,
      highToCriticalHours: row.high_to_critical_hours
    },
    statuses,
    priorityColors: parseJsonObject(row.priority_colors, defaultPriorityColors),
    boardLayout: row.board_layout,
    sla: parseJsonObject(row.sla, defaultSlaSettings),
    requireChecklistBeforeFinish: row.require_checklist_before_finish
  });
}

async function readDedicatedServiceOrderSettings() {
  const settingsResult = await query("SELECT * FROM service_order_settings WHERE id = $1", [serviceOrderSettingsRowId]);
  const statusesResult = await query(
    `
      SELECT id, name, color, sort_order, is_initial, is_final
      FROM service_order_statuses
      WHERE active = TRUE
      ORDER BY sort_order ASC, created_at ASC
    `
  );

  const statuses = statusesResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    order: row.sort_order,
    isInitial: row.is_initial,
    isFinal: row.is_final
  }));

  return settingsFromDedicatedRow(settingsResult.rows[0], statuses);
}

async function readLegacyServiceOrderSettings() {
  const result = await query("SELECT value FROM app_settings WHERE key = $1", [serviceOrderSettingsKey]);
  return result.rows[0]?.value ? normalizeServiceOrderSettings(result.rows[0].value) : null;
}

function isDefaultSettings(settings) {
  return JSON.stringify(normalizeServiceOrderSettings(settings)) ===
    JSON.stringify(normalizeServiceOrderSettings(defaultServiceOrderSettings));
}

async function persistServiceOrderSettings(settings) {
  const normalized = normalizeServiceOrderSettings(settings);

  await query(
    `
      INSERT INTO service_order_settings (
        id, number_prefix, use_year, use_month, next_number,
        auto_priority_enabled, low_to_medium_hours, medium_to_high_hours,
        high_to_critical_hours, priority_colors, board_layout,
        sla, require_checklist_before_finish, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        number_prefix = EXCLUDED.number_prefix,
        use_year = EXCLUDED.use_year,
        use_month = EXCLUDED.use_month,
        next_number = EXCLUDED.next_number,
        auto_priority_enabled = EXCLUDED.auto_priority_enabled,
        low_to_medium_hours = EXCLUDED.low_to_medium_hours,
        medium_to_high_hours = EXCLUDED.medium_to_high_hours,
        high_to_critical_hours = EXCLUDED.high_to_critical_hours,
        priority_colors = EXCLUDED.priority_colors,
        board_layout = EXCLUDED.board_layout,
        sla = EXCLUDED.sla,
        require_checklist_before_finish = EXCLUDED.require_checklist_before_finish,
        updated_at = NOW()
    `,
    [
      serviceOrderSettingsRowId,
      normalized.numberFormat.prefix,
      normalized.numberFormat.useYear,
      normalized.numberFormat.useMonth,
      normalized.numberFormat.nextNumber,
      normalized.autoPriority.enabled,
      normalized.autoPriority.lowToMediumHours,
      normalized.autoPriority.mediumToHighHours,
      normalized.autoPriority.highToCriticalHours,
      JSON.stringify(normalized.priorityColors),
      normalized.boardLayout,
      JSON.stringify(normalized.sla),
      normalized.requireChecklistBeforeFinish
    ]
  );

  const statusIds = normalized.statuses.map((status) => status.id);
  const placeholders = statusIds.map((_, index) => `$${index + 1}`).join(", ");
  await query(`DELETE FROM service_order_statuses WHERE id NOT IN (${placeholders})`, statusIds);

  for (const status of normalized.statuses) {
    await query(
      `
        INSERT INTO service_order_statuses (
          id, name, color, sort_order, is_initial, is_final, active, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          color = EXCLUDED.color,
          sort_order = EXCLUDED.sort_order,
          is_initial = EXCLUDED.is_initial,
          is_final = EXCLUDED.is_final,
          active = TRUE,
          updated_at = NOW()
      `,
      [status.id, status.name, status.color, status.order, status.isInitial, status.isFinal]
    );
  }

  await query(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [serviceOrderSettingsKey, JSON.stringify(normalized)]
  );

  return normalized;
}

async function assertRemovedStatusesAreUnused(currentStatuses = [], nextStatuses = []) {
  const nextIds = new Set(nextStatuses.map((status) => status.id));
  const removedIds = currentStatuses.map((status) => status.id).filter((id) => !nextIds.has(id));

  if (!removedIds.length) return;

  const placeholders = removedIds.map((_, index) => `$${index + 1}`).join(", ");
  const result = await query(
    `SELECT status, COUNT(*)::int AS total FROM service_orders WHERE status IN (${placeholders}) GROUP BY status`,
    removedIds
  );

  if (result.rows.length) {
    const error = new Error("Mova as OS dos status removidos antes de salvar as configuracoes.");
    error.statusCode = 400;
    throw error;
  }
}

export async function getServiceOrderSettings() {
  const dedicated = await readDedicatedServiceOrderSettings();
  const legacy = await readLegacyServiceOrderSettings();

  if (legacy && (!dedicated || (isDefaultSettings(dedicated) && !isDefaultSettings(legacy)))) {
    return persistServiceOrderSettings(legacy);
  }

  if (dedicated) return dedicated;

  return persistServiceOrderSettings(legacy || defaultServiceOrderSettings);
}

export async function updateServiceOrderSettings(payload = {}) {
  const current = await getServiceOrderSettings();
  const normalized = normalizeServiceOrderSettings({
    numberFormat: {
      ...current.numberFormat,
      ...(payload.numberFormat || {})
    },
    autoPriority: {
      ...current.autoPriority,
      ...(payload.autoPriority || {})
    },
    statuses: payload.statuses || current.statuses,
    priorityColors: {
      ...current.priorityColors,
      ...(payload.priorityColors || {})
    },
    boardLayout: payload.boardLayout || current.boardLayout,
    sla: {
      ...current.sla,
      ...(payload.sla || {})
    },
    requireChecklistBeforeFinish:
      payload.requireChecklistBeforeFinish !== undefined
        ? payload.requireChecklistBeforeFinish
        : current.requireChecklistBeforeFinish
  });

  if (Array.isArray(payload.statuses)) {
    await assertRemovedStatusesAreUnused(current.statuses, normalized.statuses);
  }

  return persistServiceOrderSettings(normalized);
}

async function serviceOrderNumberExists(number) {
  const result = await query("SELECT id FROM service_orders WHERE number = $1 LIMIT 1", [number]);
  return result.rows.length > 0;
}

async function nextServiceOrderNumber() {
  return withServiceOrderNumberLock(async () => {
    const settings = await getServiceOrderSettings();
    const totalResult = await query("SELECT COUNT(*)::int AS total FROM service_orders");
    const fallbackNext = Number(totalResult.rows[0]?.total || 0) + 1;
    let sequence = settings.numberFormat.nextNumber || fallbackNext;
    let number = formatServiceOrderNumber(sequence, settings);

    while (await serviceOrderNumberExists(number)) {
      sequence += 1;
      number = formatServiceOrderNumber(sequence, settings);
    }

    await updateServiceOrderSettings({
      ...settings,
      numberFormat: {
        ...settings.numberFormat,
        nextNumber: sequence + 1
      }
    });

    return number;
  });
}

export async function listServiceOrders(user = null) {
  const settings = await getServiceOrderSettings();
  const result = await query(`
    SELECT *
    FROM service_orders
    ORDER BY created_at DESC
  `);

  const historyResult = await query(`
    SELECT *
    FROM service_order_history
    ORDER BY created_at DESC
  `);
  const historyByOrder = new Map();

  for (const event of historyResult.rows.map(fromHistoryRow)) {
    const current = historyByOrder.get(event.serviceOrderId) || [];
    current.push(event);
    historyByOrder.set(event.serviceOrderId, current);
  }

  const orderIds = result.rows.map((row) => row.id);
  const itemsByOrder = await listServiceOrderItemsByOrderIds(orderIds);
  const feedbackByOrder = await listServiceOrderFeedbackByOrderIds(orderIds);

  const rows = result.rows.map((row) => withDisplayPriority(row, settings));

  return rows
    .map((row) => fromOrderRow(
      row,
      historyByOrder.get(row.id) || [],
      itemsByOrder.get(row.id) || [],
      settings,
      feedbackByOrder.get(row.id) || null
    ))
    .filter((order) => !user || canViewServiceOrder(user, order));
}

export async function listServiceOrdersByAssetId(assetId, { limit = 50 } = {}) {
  const settings = await getServiceOrderSettings();
  const result = await query(
    `
      SELECT *
      FROM service_orders
      WHERE asset_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [assetId, limit]
  );

  const orderIds = result.rows.map((row) => row.id);
  const itemsByOrder = await listServiceOrderItemsByOrderIds(orderIds);
  const feedbackByOrder = await listServiceOrderFeedbackByOrderIds(orderIds);
  const rows = result.rows.map((row) => withDisplayPriority(row, settings));

  return rows.map((row) =>
    fromOrderRow(row, [], itemsByOrder.get(row.id) || [], settings, feedbackByOrder.get(row.id) || null)
  );
}

export async function findServiceOrderById(id, user = null) {
  const settings = await getServiceOrderSettings();
  const result = await query("SELECT * FROM service_orders WHERE id = $1", [id]);
  const row = result.rows[0] ? withDisplayPriority(result.rows[0], settings) : null;
  if (!row) return null;

  const history = await listServiceOrderHistory(id);
  const items = await listServiceOrderItems(id);
  const order = fromOrderRow(row, history, items, settings);
  if (user && !canViewServiceOrder(user, order)) return null;
  return order;
}

async function listServiceOrderItems(serviceOrderId) {
  const result = await query(
    `
      SELECT *
      FROM service_order_items
      WHERE service_order_id = $1
      ORDER BY created_at ASC
    `,
    [serviceOrderId]
  );

  return result.rows.map(fromItemRow);
}

export async function listServiceOrderItemsByOrderIds(orderIds = []) {
  const ids = orderIds.filter(Boolean);
  const itemsByOrder = new Map();
  if (!ids.length) return itemsByOrder;

  const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");
  const result = await query(
    `
      SELECT *
      FROM service_order_items
      WHERE service_order_id IN (${placeholders})
      ORDER BY created_at ASC
    `,
    ids
  );

  for (const row of result.rows.map(fromItemRow)) {
    const current = itemsByOrder.get(row.serviceOrderId) || [];
    current.push(row);
    itemsByOrder.set(row.serviceOrderId, current);
  }

  return itemsByOrder;
}

async function replaceServiceOrderItems(serviceOrderId, items = [], db = query) {
  await db("DELETE FROM service_order_items WHERE service_order_id = $1", [serviceOrderId]);

  for (const item of normalizeServiceOrderItems(items)) {
    await db(
      `
        INSERT INTO service_order_items (
          id, service_order_id, product_id, product_name, quantity, unit_price, subtotal, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        item.id || randomUUID(),
        serviceOrderId,
        item.productId,
        item.productName,
        item.quantity,
        item.unitPrice,
        item.subtotal,
        item.notes || null
      ]
    );
  }
}

export async function listServiceOrderHistory(serviceOrderId) {
  const result = await query(
    `
      SELECT *
      FROM service_order_history
      WHERE service_order_id = $1
      ORDER BY created_at DESC
    `,
    [serviceOrderId]
  );

  return result.rows.map(fromHistoryRow);
}

export async function addServiceOrderHistory({ serviceOrderId, eventType, message, oldValue, newValue, user, db = query }) {
  const result = await db(
    `
      INSERT INTO service_order_history (
        id, service_order_id, event_type, message, old_value, new_value, user_id, user_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      randomUUID(),
      serviceOrderId,
      eventType,
      message,
      oldValue ?? null,
      newValue ?? null,
      user?.id || null,
      user?.name || null
    ]
  );

  return fromHistoryRow(result.rows[0]);
}

async function addServiceOrderAssetHistory({
  assetId,
  serviceOrder,
  eventType,
  message,
  oldValue,
  newValue,
  user,
  db = query
}) {
  if (!assetId) return null;
  return addAssetHistory({
    assetId,
    eventType: `service_order_${eventType}`,
    message: `OS ${serviceOrder.number}: ${message}`,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
    userId: user?.id || null,
    userName: user?.name || null,
    db
  });
}

function isDuplicateServiceOrderNumberError(error) {
  return error?.code === "23505" &&
    /service_orders.*number|idx_service_orders_number_unique|number/i.test(
      `${error.constraint || ""} ${error.detail || ""} ${error.message || ""}`
    );
}

export async function createServiceOrder({ payload, user, db = query }) {
  const settings = await getServiceOrderSettings();
  const initialStatus = getInitialStatus(settings).id;
  const items = normalizeServiceOrderItems(payload.items || payload.serviceItems || []);
  const sector = await resolveServiceOrderSector(payload);
  const service = await resolveServiceOrderService(payload);
  const serviceValue = payload.serviceValue !== undefined
    ? toMoneyValue(payload.serviceValue)
    : toMoneyValue(service.defaultValue);
  const totalPartsValue = sumServiceOrderItems(items);
  const totalValue = Math.round((serviceValue + totalPartsValue) * 100) / 100;
  const priority = await calculateConfiguredPriority(payload, sector, service);
  const slaDueAt = computeServiceOrderSlaDueAt(priority, settings, new Date());
  const assignedTechnicianNames = resolveAssignedTechnicianNames(payload);
  let id = randomUUID();
  let insertedRow = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    id = randomUUID();
    const number = await nextServiceOrderNumber();

    try {
      const result = await db(
        `
          INSERT INTO service_orders (
            id, number, title, description, status, priority, category, asset_id,
            problem_type, environment_id, environment_name, requester_name, contact_info,
            requester_department, requester_extension, related_asset_text, machine_scope, location,
            source, assigned_technician_name, auto_priority_enabled, notes,
            service_performed, attendance_notes,
            service_value, total_parts_value, total_value, backup_asset_id, sector_id, sector_name,
            service_id, service_code, service_name, preventive_plan_id, created_by, sla_due_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36
          )
          RETURNING *
        `,
        [
          id,
          number,
          payload.title,
          payload.description || "",
          initialStatus,
          priority,
          payload.category || null,
          payload.assetId || null,
          payload.problemType || null,
          payload.environmentId || null,
          payload.environmentName || null,
          payload.requesterName || null,
          payload.contactInfo || null,
          payload.requesterDepartment || null,
          payload.requesterExtension || null,
          payload.relatedAssetText || null,
          payload.machineScope || null,
          payload.location || null,
          payload.source || null,
          assignedTechnicianNames[0] || payload.assignedTechnicianName || null,
          payload.autoPriorityEnabled ?? settings.autoPriority.enabled,
          payload.notes || null,
          payload.servicePerformed || null,
          payload.attendanceNotes || null,
          serviceValue,
          totalPartsValue,
          totalValue,
          payload.backupAssetId || null,
          sector.sectorId,
          sector.sectorName,
          service.serviceId,
          service.serviceCode,
          service.serviceName,
          payload.preventivePlanId || null,
          user?.id || null,
          slaDueAt
        ]
      );
      insertedRow = result.rows[0];
      const assignedResult = await db(
        "UPDATE service_orders SET assigned_technician_names = $2::jsonb WHERE id = $1 RETURNING *",
        [id, JSON.stringify(assignedTechnicianNames)]
      );
      insertedRow = assignedResult.rows[0] || insertedRow;
      break;
    } catch (error) {
      if (attempt < 4 && isDuplicateServiceOrderNumberError(error)) continue;
      throw error;
    }
  }

  if (!insertedRow) {
    const error = new Error("Não foi possível criar a Ordem de Serviço.");
    error.statusCode = 500;
    throw error;
  }

  if (items.length) {
    await replaceServiceOrderItems(id, items, db);
  }

  const createdHistory = await addServiceOrderHistory({
    serviceOrderId: id,
    eventType: "created",
    message: `OS criada no setor ${sector.sectorName}.`,
    newValue: payload.title,
    user,
    db
  });
  await addServiceOrderAssetHistory({
    assetId: insertedRow.asset_id,
    serviceOrder: insertedRow,
    eventType: "created",
    message: `criada no setor ${sector.sectorName}.`,
    newValue: payload.title,
    user,
    db
  });

  return fromOrderRow(insertedRow, [createdHistory], items, settings);
}

export async function updateServiceOrder({ id, payload, user }) {
  const current = await findServiceOrderById(id, user);
  if (!current) return null;

  const settings = await getServiceOrderSettings();
  const finalStatus = getFinalStatus(settings).id;
  const nextStatus = payload.status ?? current.status;
  const closedAt = nextStatus === finalStatus ? current.closedAt || new Date().toISOString() : null;
  const hasItemsPayload = Object.prototype.hasOwnProperty.call(payload, "items")
    || Object.prototype.hasOwnProperty.call(payload, "serviceItems");
  const nextItems = hasItemsPayload
    ? normalizeServiceOrderItems(payload.items ?? payload.serviceItems ?? [])
    : normalizeServiceOrderItems(current.items || current.serviceItems || []);
  const sector = await resolveServiceOrderSector(payload, current);
  const service = await resolveServiceOrderService(payload, current);
  const serviceValue = payload.serviceValue !== undefined
    ? toMoneyValue(payload.serviceValue)
    : hasServicePayload(payload) && service.defaultValue != null
      ? toMoneyValue(service.defaultValue)
      : toMoneyValue(current.serviceValue);
  const totalPartsValue = sumServiceOrderItems(nextItems);
  const totalValue = Math.round((serviceValue + totalPartsValue) * 100) / 100;
  const itemsChanged = hasItemsPayload && itemsSignature(current.items || []) !== itemsSignature(nextItems);
  const assignedTechnicianNames = resolveAssignedTechnicianNames(payload, current);

  const result = await query(
    `
      UPDATE service_orders
      SET title = $2,
          description = $3,
          status = $4,
          priority = $5,
          category = $6,
          asset_id = $7,
          problem_type = $8,
          environment_id = $9,
          environment_name = $10,
          requester_name = $11,
          contact_info = $12,
          requester_department = $13,
          requester_extension = $14,
          related_asset_text = $15,
          machine_scope = $16,
          location = $17,
          source = $18,
          assigned_technician_name = $19,
          auto_priority_enabled = $20,
          work_notes = $21,
          diagnosis = $22,
          solution = $23,
          parts_used = $24,
          notes = $25,
          closed_at = $26,
          service_value = $27,
          total_parts_value = $28,
          total_value = $29,
          backup_asset_id = $30,
          service_performed = $31,
          attendance_notes = $32,
          sector_id = $33,
          sector_name = $34,
          service_id = $35,
          service_code = $36,
          service_name = $37,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      payload.title ?? current.title,
      payload.description ?? current.description,
      nextStatus,
      payload.priority ?? current.priority,
      payload.category ?? current.category,
      Object.prototype.hasOwnProperty.call(payload, "assetId")
        ? payload.assetId || null
        : current.assetId,
      payload.problemType ?? current.problemType,
      payload.environmentId ?? current.environmentId,
      payload.environmentName ?? current.environmentName,
      payload.requesterName ?? current.requesterName,
      payload.contactInfo ?? current.contactInfo,
      payload.requesterDepartment ?? current.requesterDepartment,
      payload.requesterExtension ?? current.requesterExtension,
      payload.relatedAssetText ?? current.relatedAssetText,
      payload.machineScope ?? current.machineScope,
      payload.location ?? current.location,
      payload.source ?? current.source,
      assignedTechnicianNames[0] || null,
      payload.autoPriorityEnabled ?? current.autoPriorityEnabled,
      payload.workNotes ?? current.workNotes,
      payload.diagnosis ?? current.diagnosis,
      payload.solution ?? current.solution,
      payload.partsUsed ?? current.partsUsed,
      payload.notes ?? current.notes,
      closedAt,
      serviceValue,
      totalPartsValue,
      totalValue,
      Object.prototype.hasOwnProperty.call(payload, "backupAssetId")
        ? payload.backupAssetId
        : current.backupAssetId,
      payload.servicePerformed ?? current.servicePerformed,
      payload.attendanceNotes ?? current.attendanceNotes,
      sector.sectorId,
      sector.sectorName,
      service.serviceId,
      service.serviceCode,
      service.serviceName
    ]
  );

  if (hasItemsPayload) {
    await replaceServiceOrderItems(id, nextItems);
  }

  let updatedRow = result.rows[0];
  if (Object.prototype.hasOwnProperty.call(payload, "assignedTechnicianNames") || Object.prototype.hasOwnProperty.call(payload, "assignedTechnicianName")) {
    const assignedResult = await query(
      "UPDATE service_orders SET assigned_technician_names = $2::jsonb WHERE id = $1 RETURNING *",
      [id, JSON.stringify(assignedTechnicianNames)]
    );
    updatedRow = assignedResult.rows[0] || updatedRow;
  }
  const nextAssetId = updatedRow.asset_id || null;
  const changes = [
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
    ["parts", "Peças trocadas registradas.", current.partsUsed, hasItemsPayload ? undefined : payload.partsUsed]
  ];

  for (const [eventType, message, oldValue, newValue] of changes) {
    if (newValue !== undefined && String(oldValue ?? "") !== String(newValue ?? "")) {
      await addServiceOrderHistory({ serviceOrderId: id, eventType, message, oldValue, newValue, user });
      if (eventType !== "asset") {
        await addServiceOrderAssetHistory({
          assetId: nextAssetId,
          serviceOrder: updatedRow,
          eventType,
          message,
          oldValue,
          newValue,
          user
        });
      }
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "assetId")
    && String(current.assetId || "") !== String(nextAssetId || "")
  ) {
    await addServiceOrderAssetHistory({
      assetId: current.assetId,
      serviceOrder: updatedRow,
      eventType: "unlinked",
      message: "desvinculada desta máquina.",
      oldValue: current.assetId,
      newValue: nextAssetId,
      user
    });
    await addServiceOrderAssetHistory({
      assetId: nextAssetId,
      serviceOrder: updatedRow,
      eventType: "linked",
      message: "vinculada a esta máquina.",
      oldValue: current.assetId,
      newValue: nextAssetId,
      user
    });
  }

  if (itemsChanged) {
    const oldValue = formatItemsForHistory(current.items || []);
    const newValue = formatItemsForHistory(nextItems);
    await addServiceOrderHistory({
      serviceOrderId: id,
      eventType: "service_order_items",
      message: `Pecas e valores registrados na OS ${current.number}.`,
      oldValue,
      newValue,
      user
    });
    await addServiceOrderAssetHistory({
      assetId: nextAssetId,
      serviceOrder: updatedRow,
      eventType: "items",
      message: "Peças e valores atualizados.",
      oldValue,
      newValue,
      user
    });
  }

  return {
    ...fromOrderRow(updatedRow, await listServiceOrderHistory(id), await listServiceOrderItems(id), settings)
  };
}

export async function updateServiceOrderStatus({ id, status, user }) {
  const current = await findServiceOrderById(id, user);
  if (!current) return null;
  const settings = await getServiceOrderSettings();
  const initialStatus = getInitialStatus(settings).id;
  const finalStatus = getFinalStatus(settings).id;

  const result = await query(
    `
      UPDATE service_orders
      SET status = $2,
          closed_at = CASE WHEN $2 = $3 THEN COALESCE(closed_at, NOW()) ELSE NULL END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, status, finalStatus]
  );

  await addServiceOrderHistory({
    serviceOrderId: id,
    eventType: status === finalStatus ? "closed" : status === initialStatus ? "reopened" : "status",
    message: status === finalStatus ? "OS finalizada." : status === initialStatus ? "OS reaberta." : "Status da OS alterado.",
    oldValue: current.status,
    newValue: status,
    user
  });
  await addServiceOrderAssetHistory({
    assetId: current.assetId,
    serviceOrder: result.rows[0],
    eventType: status === finalStatus ? "closed" : status === initialStatus ? "reopened" : "status",
    message: status === finalStatus ? "finalizada." : status === initialStatus ? "reaberta." : "status alterado.",
    oldValue: current.status,
    newValue: status,
    user
  });

  return {
    ...fromOrderRow(result.rows[0], await listServiceOrderHistory(id), await listServiceOrderItems(id), settings)
  };
}

export async function deleteServiceOrder(id, user = null) {
  const current = await findServiceOrderById(id);
  if (!current) return null;

  await addServiceOrderAssetHistory({
    assetId: current.assetId,
    serviceOrder: current,
    eventType: "deleted",
    message: "excluída do sistema.",
    oldValue: current.status,
    user
  });
  await query("DELETE FROM service_orders WHERE id = $1", [id]);
  return current;
}

function makeHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

// Reabertura tem dois caminhos: o dropdown de status generico ja tratava
// implicitamente "voltar pro status inicial" como reopened (sem exigir
// motivo, comportamento existente preservado). Esta funcao e o caminho
// dedicado e mais forte: exige motivo, incrementa reopen_count e reinicia
// o prazo de SLA a partir de agora (nova janela de atendimento).
export async function reopenServiceOrder({ id, reason, user }) {
  const settings = await getServiceOrderSettings();
  const current = await findServiceOrderById(id);
  if (!current) return null;

  const finalStatusId = getFinalStatus(settings).id;
  if (current.status !== finalStatusId) {
    throw makeHttpError("Só é possível reabrir uma Ordem de Serviço finalizada.");
  }

  const normalizedReason = String(reason || "").trim();
  if (normalizedReason.length < 3) {
    throw makeHttpError("Informe o motivo da reabertura.");
  }

  const initialStatusId = getInitialStatus(settings).id;
  const nextSlaDueAt = computeServiceOrderSlaDueAt(current.priority, settings, new Date());

  const result = await query(
    `
      UPDATE service_orders
      SET status = $2,
          closed_at = NULL,
          reopened_at = NOW(),
          reopened_by = $3,
          reopen_reason = $4,
          reopen_count = reopen_count + 1,
          sla_due_at = $5,
          sla_breached_at = NULL,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, initialStatusId, user?.id || null, normalizedReason, nextSlaDueAt]
  );
  const updatedRow = result.rows[0];

  await addServiceOrderHistory({
    serviceOrderId: id,
    eventType: "reopened",
    message: `OS reaberta. Motivo: ${normalizedReason}`,
    oldValue: current.status,
    newValue: initialStatusId,
    user
  });
  await addServiceOrderAssetHistory({
    assetId: current.assetId,
    serviceOrder: updatedRow,
    eventType: "reopened",
    message: `reaberta. Motivo: ${normalizedReason}`,
    oldValue: current.status,
    newValue: initialStatusId,
    user
  });

  return fromOrderRow(updatedRow, await listServiceOrderHistory(id), await listServiceOrderItems(id), settings);
}

function fromFeedbackRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    serviceOrderId: row.service_order_id,
    rating: Number(row.rating),
    comment: row.comment,
    submittedByName: row.submitted_by_name,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    source: row.source
  };
}

export async function findServiceOrderFeedback(serviceOrderId) {
  const result = await query(
    "SELECT * FROM service_order_feedback WHERE service_order_id = $1",
    [serviceOrderId]
  );
  return fromFeedbackRow(result.rows[0]);
}

export async function listServiceOrderFeedbackByOrderIds(orderIds = []) {
  const ids = orderIds.filter(Boolean);
  const feedbackByOrder = new Map();
  if (!ids.length) return feedbackByOrder;

  const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");
  const result = await query(
    `SELECT * FROM service_order_feedback WHERE service_order_id IN (${placeholders})`,
    ids
  );
  for (const row of result.rows.map(fromFeedbackRow)) {
    feedbackByOrder.set(row.serviceOrderId, row);
  }
  return feedbackByOrder;
}

// Avaliacao interna (registrada por admin/tecnico dentro da OS) - sem
// fluxo de link publico com token nesta rodada. Uma avaliacao por OS
// (indice unico) - reenviar atualiza a existente.
export async function submitServiceOrderFeedback({ id, rating, comment, user, source = "internal" }) {
  const current = await findServiceOrderById(id);
  if (!current) return null;

  const normalizedRating = Math.trunc(Number(rating));
  if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw makeHttpError("A avaliação deve ser uma nota de 1 a 5.");
  }

  const result = await query(
    `
      INSERT INTO service_order_feedback (
        id, service_order_id, rating, comment, submitted_by_name, submitted_by, source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (service_order_id)
      DO UPDATE SET
        rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        submitted_by_name = EXCLUDED.submitted_by_name,
        submitted_by = EXCLUDED.submitted_by,
        submitted_at = NOW(),
        source = EXCLUDED.source
      RETURNING *
    `,
    [randomUUID(), id, normalizedRating, comment || null, user?.name || null, user?.id || null, source]
  );

  await addServiceOrderHistory({
    serviceOrderId: id,
    eventType: "feedback_submitted",
    message: `Avaliação registrada: ${normalizedRating}/5.`,
    newValue: String(normalizedRating),
    user
  });
  await addServiceOrderAssetHistory({
    assetId: current.assetId,
    serviceOrder: current,
    eventType: "feedback_submitted",
    message: `avaliação registrada: ${normalizedRating}/5.`,
    newValue: String(normalizedRating),
    user
  });

  return fromFeedbackRow(result.rows[0]);
}

const BLOCKED_ATTACHMENT_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".ps1", ".js", ".vbs", ".msi", ".scr", ".jar", ".com"
]);
export const serviceOrderAttachmentCategories = new Set([
  "evidencia", "orcamento", "foto", "documento", "print", "outro"
]);

function fileExtension(value) {
  const match = String(value || "").trim().match(/\.[a-z0-9]+$/i);
  return match ? match[0].toLowerCase() : "";
}

function assertSafeAttachmentReference(value, fieldLabel) {
  const ext = fileExtension(value);
  if (ext && BLOCKED_ATTACHMENT_EXTENSIONS.has(ext)) {
    throw makeHttpError(`${fieldLabel} aponta para um tipo de arquivo não permitido (${ext}).`);
  }
}

function fromAttachmentRow(row) {
  return {
    id: row.id,
    serviceOrderId: row.service_order_id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size != null ? Number(row.file_size) : null,
    storageKey: row.storage_key,
    category: row.category,
    description: row.description,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at
  };
}

export async function listServiceOrderAttachments(serviceOrderId) {
  const result = await query(
    "SELECT * FROM service_order_attachments WHERE service_order_id = $1 ORDER BY uploaded_at DESC",
    [serviceOrderId]
  );
  return result.rows.map(fromAttachmentRow);
}

/**
 * Anexo metadata-only: nenhuma infraestrutura de upload/storage existe no
 * projeto hoje (sem multer, sem S3/disco). `storageKey` e uma referencia
 * em texto (link/descricao de onde a evidencia real esta guardada), nao
 * um upload binario - limitacao documentada em docs/ORDENS-DE-SERVICO.md.
 * A validacao de extensao ainda se aplica ao nome/referencia informados.
 */
export async function createServiceOrderAttachment({
  serviceOrderId,
  fileName,
  fileType,
  fileSize,
  storageKey,
  category,
  description,
  user
}) {
  const current = await findServiceOrderById(serviceOrderId);
  if (!current) return null;

  const normalizedFileName = String(fileName || "").trim();
  if (normalizedFileName.length < 1) {
    throw makeHttpError("Informe o nome do anexo.");
  }
  assertSafeAttachmentReference(normalizedFileName, "O nome do anexo");
  assertSafeAttachmentReference(storageKey, "A referência do anexo");

  const normalizedCategory = serviceOrderAttachmentCategories.has(category) ? category : "outro";
  const size = Number(fileSize);

  const result = await query(
    `
      INSERT INTO service_order_attachments (
        id, service_order_id, file_name, file_type, file_size, storage_key, category, description, uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      randomUUID(),
      serviceOrderId,
      normalizedFileName.slice(0, 255),
      fileType ? String(fileType).slice(0, 100) : null,
      Number.isFinite(size) && size >= 0 ? Math.trunc(size) : null,
      storageKey ? String(storageKey).slice(0, 1000) : null,
      normalizedCategory,
      description ? String(description).slice(0, 1000) : null,
      user?.id || null
    ]
  );

  await addServiceOrderHistory({
    serviceOrderId,
    eventType: "attachment_added",
    message: `Anexo adicionado: ${normalizedFileName}.`,
    newValue: normalizedFileName,
    user
  });
  await addServiceOrderAssetHistory({
    assetId: current.assetId,
    serviceOrder: current,
    eventType: "attachment_added",
    message: `anexo adicionado: ${normalizedFileName}.`,
    newValue: normalizedFileName,
    user
  });

  return fromAttachmentRow(result.rows[0]);
}

export async function deleteServiceOrderAttachment(serviceOrderId, attachmentId, user = null) {
  const current = await findServiceOrderById(serviceOrderId);
  if (!current) return null;

  const result = await query(
    "DELETE FROM service_order_attachments WHERE id = $1 AND service_order_id = $2 RETURNING *",
    [attachmentId, serviceOrderId]
  );
  const deleted = result.rows[0] ? fromAttachmentRow(result.rows[0]) : null;
  if (!deleted) return null;

  await addServiceOrderHistory({
    serviceOrderId,
    eventType: "attachment_removed",
    message: `Anexo removido: ${deleted.fileName}.`,
    oldValue: deleted.fileName,
    user
  });
  await addServiceOrderAssetHistory({
    assetId: current.assetId,
    serviceOrder: current,
    eventType: "attachment_removed",
    message: `anexo removido: ${deleted.fileName}.`,
    oldValue: deleted.fileName,
    user
  });

  return deleted;
}


