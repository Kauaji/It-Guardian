/** @import { ServiceOrderSettings, ServiceOrderSettingsInput, ServiceOrderStatus, ServiceOrderStatusInput, SlaSettings } from "./types.js" */

export const serviceOrderNumberDigits = 4;

/** @type {Record<string, string>} */
export const defaultPriorityColors = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#ea580c",
  critical: "#dc2626"
};

export const maxServiceOrderStatuses = 10;

/** @type {ServiceOrderStatus[]} */
export const defaultServiceOrderStatuses = [
  { id: "open", name: "Aberta", color: "#2563eb", order: 0, isInitial: true, isFinal: false },
  { id: "in_progress", name: "Em atendimento", color: "#d97706", order: 1, isInitial: false, isFinal: false },
  { id: "waiting", name: "Aguardando", color: "#7c3aed", order: 2, isInitial: false, isFinal: false },
  { id: "closed", name: "Finalizada", color: "#16a34a", order: 3, isInitial: false, isFinal: true }
];

/** @type {SlaSettings} */
export const defaultSlaSettings = {
  low: 72,
  medium: 48,
  high: 24,
  critical: 4,
  nearDuePercent: 20,
  nearDueMinHours: 2
};

/** @type {ServiceOrderSettings} */
export const defaultServiceOrderSettings = {
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

/**
 * @param {ServiceOrderSettingsInput} [value]
 * @returns {Omit<ServiceOrderSettings, "statuses"> & { statuses: ServiceOrderStatusInput[] }} Padroes sobrepostos pelos campos presentes (sem normalizar).
 */
export function mergeServiceOrderSettings(value = {}) {
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

/**
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
export function slugifyStatusId(value, fallback) {
  const id = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return id || fallback;
}

/**
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string} `#rrggbb` valido ou `fallback`.
 */
export function sanitizeStatusColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
}

/**
 * @param {ServiceOrderStatusInput} [status]
 * @param {number} [index]
 * @returns {ServiceOrderStatus}
 */
export function normalizeStatus(status = {}, index = 0) {
  const fallback = defaultServiceOrderStatuses[index] || {
    id: `status_${index + 1}`,
    name: `Status ${index + 1}`,
    color: "#64748b",
    order: index
  };
  const name =
    String(status.name || status.label || fallback.name)
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

/**
 * @param {ServiceOrderStatusInput[]} [statuses]
 * @returns {ServiceOrderStatus[]} Entre 2 e 10 status unicos, com exatamente um inicial e um final.
 */
export function normalizeStatuses(statuses = []) {
  const source = (Array.isArray(statuses) && statuses.length ? statuses : defaultServiceOrderStatuses).slice(0, maxServiceOrderStatuses);
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
      : Math.max(
          0,
          normalized.findIndex((status) => status.id === "open")
        );
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

/**
 * @param {ServiceOrderSettingsInput} [value]
 * @returns {ServiceOrderSettings}
 */
export function normalizeServiceOrderSettings(value = {}) {
  const merged = mergeServiceOrderSettings(value);
  const nextNumber = Number(merged.numberFormat.nextNumber);
  const boardLayout = merged.boardLayout === "vertical" ? "vertical" : "horizontal";

  return {
    numberFormat: {
      prefix:
        String(merged.numberFormat.prefix || "OS")
          .trim()
          .toUpperCase()
          .slice(0, 12) || "OS",
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

/**
 * @param {number | string} sequence
 * @param {ServiceOrderSettingsInput} [settings]
 * @returns {string}
 */
export function formatServiceOrderNumber(sequence, settings = defaultServiceOrderSettings) {
  const { prefix, useYear, useMonth } = normalizeServiceOrderSettings(settings).numberFormat;
  const padded = String(sequence).padStart(serviceOrderNumberDigits, "0");
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return [prefix, useYear ? year : "", useMonth ? month : "", padded].filter(Boolean).join("-");
}

/**
 * @param {ServiceOrderSettingsInput} [settings]
 * @returns {ServiceOrderStatus}
 */
export function getInitialStatus(settings = defaultServiceOrderSettings) {
  return normalizeServiceOrderSettings(settings).statuses.find((status) => status.isInitial) || defaultServiceOrderStatuses[0];
}

/**
 * @param {ServiceOrderSettingsInput} [settings]
 * @returns {ServiceOrderStatus}
 */
export function getFinalStatus(settings = defaultServiceOrderSettings) {
  return (
    normalizeServiceOrderSettings(settings).statuses.find((status) => status.isFinal) ||
    defaultServiceOrderStatuses[defaultServiceOrderStatuses.length - 1]
  );
}

/**
 * @param {ServiceOrderSettingsInput} settings
 * @param {string} statusId
 * @returns {boolean}
 */
export function hasServiceOrderStatus(settings, statusId) {
  return normalizeServiceOrderSettings(settings).statuses.some((status) => status.id === statusId);
}

/**
 * @param {ServiceOrderSettingsInput} settings
 * @returns {boolean}
 */
export function isDefaultSettings(settings) {
  return (
    JSON.stringify(normalizeServiceOrderSettings(settings)) === JSON.stringify(normalizeServiceOrderSettings(defaultServiceOrderSettings))
  );
}

/**
 * Combina o payload parcial de uma atualizacao de configuracoes com as
 * configuracoes atuais e normaliza o resultado (funcao pura).
 *
 * @param {ServiceOrderSettings} current
 * @param {ServiceOrderSettingsInput} [payload]
 * @returns {ServiceOrderSettings}
 */
export function mergeServiceOrderSettingsUpdate(current, payload = {}) {
  return normalizeServiceOrderSettings({
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
      payload.requireChecklistBeforeFinish !== undefined ? payload.requireChecklistBeforeFinish : current.requireChecklistBeforeFinish
  });
}
