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
  boardLayout: "horizontal"
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
    boardLayout: value.boardLayout || defaultServiceOrderSettings.boardLayout
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
    boardLayout
  };
}

function formatServiceOrderNumber(sequence, settings = defaultServiceOrderSettings) {
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
  if (
    normalizeText(order.assignedTechnicianName) &&
    (normalizeText(order.assignedTechnicianName) === normalizeText(user.name) ||
      normalizeText(order.assignedTechnicianName) === normalizeText(user.email))
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

async function applyAutoPriority(row, settings) {
  const nextPriority = getTimedPriority(row, settings);
  if (nextPriority === row.priority) return row;

  const result = await query(
    `
      UPDATE service_orders
      SET priority = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [row.id, nextPriority]
  );

  await addServiceOrderHistory({
    serviceOrderId: row.id,
    eventType: "auto_priority",
    message: "Prioridade automatica alterada por tempo.",
    oldValue: row.priority,
    newValue: nextPriority,
    user: { name: "Sistema" }
  });

  return result.rows[0] || row;
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

function fromOrderRow(row, history = [], items = []) {
  return {
    id: row.id,
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
    requesterName: row.requester_name,
    contactInfo: row.contact_info,
    requesterDepartment: row.requester_department,
    requesterExtension: row.requester_extension,
    relatedAssetText: row.related_asset_text,
    machineScope: row.machine_scope,
    location: row.location,
    source: row.source,
    assignedTechnicianName: row.assigned_technician_name,
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
    history
  };
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
    boardLayout: row.board_layout
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
        high_to_critical_hours, priority_colors, board_layout, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
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
      normalized.boardLayout
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
    boardLayout: payload.boardLayout || current.boardLayout
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

  const itemsByOrder = await listServiceOrderItemsByOrderIds(result.rows.map((row) => row.id));

  const rows = [];
  for (const row of result.rows) {
    rows.push(await applyAutoPriority(row, settings));
  }

  return rows
    .map((row) => fromOrderRow(row, historyByOrder.get(row.id) || [], itemsByOrder.get(row.id) || []))
    .filter((order) => !user || canViewServiceOrder(user, order));
}

export async function findServiceOrderById(id, user = null) {
  const settings = await getServiceOrderSettings();
  const result = await query("SELECT * FROM service_orders WHERE id = $1", [id]);
  const row = result.rows[0] ? await applyAutoPriority(result.rows[0], settings) : null;
  if (!row) return null;

  const history = await listServiceOrderHistory(id);
  const items = await listServiceOrderItems(id);
  const order = fromOrderRow(row, history, items);
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

async function listServiceOrderItemsByOrderIds(orderIds = []) {
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

async function replaceServiceOrderItems(serviceOrderId, items = []) {
  await query("DELETE FROM service_order_items WHERE service_order_id = $1", [serviceOrderId]);

  for (const item of normalizeServiceOrderItems(items)) {
    await query(
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

export async function addServiceOrderHistory({ serviceOrderId, eventType, message, oldValue, newValue, user }) {
  const result = await query(
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

function isDuplicateServiceOrderNumberError(error) {
  return error?.code === "23505" &&
    /service_orders.*number|idx_service_orders_number_unique|number/i.test(
      `${error.constraint || ""} ${error.detail || ""} ${error.message || ""}`
    );
}

export async function createServiceOrder({ payload, user }) {
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
  let id = randomUUID();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    id = randomUUID();
    const number = await nextServiceOrderNumber();

    try {
      await query(
        `
          INSERT INTO service_orders (
            id, number, title, description, status, priority, category, asset_id,
            problem_type, environment_id, environment_name, requester_name, contact_info,
            requester_department, requester_extension, related_asset_text, machine_scope, location,
            source, assigned_technician_name, auto_priority_enabled, notes,
            service_performed, attendance_notes,
            service_value, total_parts_value, total_value, backup_asset_id, sector_id, sector_name,
            service_id, service_code, service_name, created_by
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34
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
          payload.assignedTechnicianName || null,
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
          user?.id || null
        ]
      );
      break;
    } catch (error) {
      if (attempt < 4 && isDuplicateServiceOrderNumberError(error)) continue;
      throw error;
    }
  }

  if (items.length) {
    await replaceServiceOrderItems(id, items);
  }

  await addServiceOrderHistory({
    serviceOrderId: id,
    eventType: "created",
    message: `OS criada no setor ${sector.sectorName}.`,
    newValue: payload.title,
    user
  });

  return findServiceOrderById(id);
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
      payload.assetId ?? current.assetId,
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
      payload.assignedTechnicianName ?? current.assignedTechnicianName,
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

  const changes = [
    ["priority", "Prioridade alterada.", current.priority, payload.priority],
    ["assigned", "Tecnico responsavel alterado.", current.assignedTechnicianName, payload.assignedTechnicianName],
    ["asset", "Maquina vinculada a Ordem de Servico.", current.assetId, payload.assetId],
    ["backup", "Maquina Backup vinculada a OS.", current.backupAssetId, payload.backupAssetId],
    ["auto_priority", "Prioridade automatica alterada.", current.autoPriorityEnabled, payload.autoPriorityEnabled],
    ["diagnosis", "Diagnostico atualizado.", current.diagnosis, payload.diagnosis],
    ["service_performed", "Servico realizado atualizado.", current.servicePerformed, payload.servicePerformed],
    ["attendance_notes", "Observacoes do atendimento atualizadas.", current.attendanceNotes, payload.attendanceNotes],
    ["service_value", "Valor do serviço alterado.", current.serviceValue, payload.serviceValue !== undefined ? serviceValue : undefined],
    ["sector", `Setor alterado de ${current.sectorName || generalSector.name} para ${sector.sectorName}.`, current.sectorName, sector.sectorName],
    ["service", "Servico da OS alterado.", current.serviceName || current.serviceCode, service.serviceName || service.serviceCode],
    ["parts", `Pecas trocadas registradas na OS ${current.number}.`, current.partsUsed, hasItemsPayload ? undefined : payload.partsUsed]
  ];

  for (const [eventType, message, oldValue, newValue] of changes) {
    if (newValue !== undefined && `${oldValue || ""}` !== `${newValue || ""}`) {
      await addServiceOrderHistory({ serviceOrderId: id, eventType, message, oldValue, newValue, user });
    }
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
  }

  if (
    payload.partsUsed !== undefined &&
    !hasItemsPayload &&
    `${current.partsUsed || ""}` !== `${payload.partsUsed || ""}` &&
    (payload.assetId || current.assetId)
  ) {
    await addAssetHistory({
      assetId: payload.assetId || current.assetId,
      eventType: "parts",
      message: `Peca trocada na OS ${current.number}: ${payload.partsUsed}`,
      oldValue: current.partsUsed,
      newValue: payload.partsUsed,
      userId: user?.id || null,
      userName: user?.name || null
    });
  }

  if (itemsChanged && (payload.assetId || current.assetId)) {
    await addAssetHistory({
      assetId: payload.assetId || current.assetId,
      eventType: "parts",
      message: `Pecas trocadas na OS ${current.number}: ${formatItemsForHistory(nextItems)}`,
      oldValue: formatItemsForHistory(current.items || []),
      newValue: formatItemsForHistory(nextItems),
      userId: user?.id || null,
      userName: user?.name || null
    });
  }

  return {
    ...fromOrderRow(result.rows[0], await listServiceOrderHistory(id), await listServiceOrderItems(id))
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

  return {
    ...fromOrderRow(result.rows[0], await listServiceOrderHistory(id), await listServiceOrderItems(id))
  };
}

export async function deleteServiceOrder(id) {
  const current = await findServiceOrderById(id);
  if (!current) return null;

  await query("DELETE FROM service_orders WHERE id = $1", [id]);
  return current;
}
