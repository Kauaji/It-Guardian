import { buildIsFinalServiceOrderStatus } from "../../domain/serviceOrderAggregates.js";
import { badRequest } from "../../lib/errors.js";
import { calculateServiceOrderSla } from "../../repositories/serviceOrderRepository.js";

export const dashboardAssetStatuses = new Set(["online", "offline", "problem", "unknown"]);
export const dashboardAlertSeverities = new Set(["critical", "high", "medium", "low", "warning", "info"]);
const filterNames = new Set(["assetStatus", "assetId", "alertSeverity", "serviceOrderStatus", "overdue"]);
const MAX_FILTER_VALUE_LENGTH = 200;

function invalidFilter(message) {
  return badRequest(`Filtro de dashboard invalido: ${message}`, { code: "invalid_dashboard_filter" });
}

/** Transient selections are separate from widget config/layout; no coercion of arrays or booleans. */
export function normalizeDashboardFilters(value) {
  if (value === undefined || value === null) return {};
  if (
    typeof value !== "object" || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    throw invalidFilter("filters deve ser um objeto.");
  }
  if (Object.keys(value).length > filterNames.size) throw invalidFilter("quantidade de dimensoes excedida.");

  const normalized = {};
  for (const [key, selection] of Object.entries(value)) {
    if (!filterNames.has(key)) throw invalidFilter("dimensao desconhecida.");
    if (key === "overdue") {
      if (typeof selection !== "boolean") throw invalidFilter("overdue deve ser booleano.");
      normalized[key] = selection;
      continue;
    }
    if (
      typeof selection !== "string" || !selection.trim() || selection.length > MAX_FILTER_VALUE_LENGTH ||
      [...selection].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    ) {
      throw invalidFilter(`${key} deve conter uma selecao de ate ${MAX_FILTER_VALUE_LENGTH} caracteres.`);
    }
    normalized[key] = selection.trim();
  }

  if (normalized.assetStatus && !dashboardAssetStatuses.has(normalized.assetStatus)) {
    throw invalidFilter("status de ativo desconhecido.");
  }
  if (normalized.alertSeverity && !dashboardAlertSeverities.has(normalized.alertSeverity)) {
    throw invalidFilter("severidade desconhecida.");
  }
  return normalized;
}

export function validateDashboardOrderStatus(filters, settings) {
  if (filters.serviceOrderStatus && !settings?.statuses?.some((status) => status.id === filters.serviceOrderStatus)) {
    throw invalidFilter("status de OS desconhecido.");
  }
}

function idOf(value) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function alertAssetId(alert) {
  return idOf(alert.assetId || alert.hostId);
}

function hasOrderFilter(filters) {
  return Boolean(filters.serviceOrderStatus) || typeof filters.overdue === "boolean";
}

function hasAssetFilter(filters) {
  return Boolean(filters.assetId || filters.assetStatus);
}

function matchesOrderDimensions(order, filters, settings, now) {
  if (filters.serviceOrderStatus && order.status !== filters.serviceOrderStatus) return false;
  if (typeof filters.overdue !== "boolean") return true;
  // Identical to the overdue widget: only OPEN orders with a real, breached SLA.
  // false is its complement, including closed orders and orders without an SLA.
  const isFinal = buildIsFinalServiceOrderStatus(settings);
  const overdue = !isFinal(order.status) && calculateServiceOrderSla(order, settings, now).breached;
  return overdue === filters.overdue;
}

/** Relationships are joined only on existing inventory IDs, never names, IPs or labels. */
export function buildDashboardAssetScope({ devices, activeAlerts = [], serviceOrders = [], settings }, filters, now = new Date()) {
  const alertAssetIds = filters.alertSeverity
    ? new Set(activeAlerts.filter((alert) => alert.severity === filters.alertSeverity).map(alertAssetId))
    : null;
  const orderAssetIds = hasOrderFilter(filters)
    ? new Set(serviceOrders.filter((order) => matchesOrderDimensions(order, filters, settings, now)).map((order) => idOf(order.assetId)))
    : null;
  const scopedDevices = devices.filter((device) => {
    const id = idOf(device.id);
    if (!id || (filters.assetId && id !== filters.assetId)) return false;
    const status = dashboardAssetStatuses.has(device.status) ? device.status : "unknown";
    if (filters.assetStatus && status !== filters.assetStatus) return false;
    return (!alertAssetIds || alertAssetIds.has(id)) && (!orderAssetIds || orderAssetIds.has(id));
  });
  return { devices: scopedDevices, assetIds: new Set(scopedDevices.map((device) => idOf(device.id))) };
}

export function filterDashboardAlerts(alerts, filters, assetIds) {
  const needsAssetRelation = hasAssetFilter(filters) || hasOrderFilter(filters);
  return alerts.filter((alert) =>
    (!filters.alertSeverity || alert.severity === filters.alertSeverity) &&
    (!needsAssetRelation || assetIds.has(alertAssetId(alert)))
  );
}

export function filterDashboardServiceOrders(orders, filters, assetIds, settings, now = new Date()) {
  const needsAssetRelation = hasAssetFilter(filters) || Boolean(filters.alertSeverity);
  return orders.filter((order) =>
    matchesOrderDimensions(order, filters, settings, now) &&
    (!needsAssetRelation || assetIds.has(idOf(order.assetId)))
  );
}

/** Unknown/unlinked audit events cannot be correlated to an asset by their prose. */
export function filterDashboardEvents(logs, { assetIds, alertIds, serviceOrderIds }) {
  return logs.filter((log) => {
    const meta = log.meta || {};
    const checks = [];
    for (const field of ["assetId", "deviceId", "hostId"]) {
      if (meta[field] != null) checks.push(assetIds.has(idOf(meta[field])));
    }
    if (meta.alertId != null) checks.push(alertIds.has(idOf(meta.alertId)));
    if (meta.serviceOrderId != null) checks.push(serviceOrderIds.has(idOf(meta.serviceOrderId)));
    return checks.length > 0 && checks.every(Boolean);
  });
}

/** Wrap already permission-scoped sources; memoization never crosses HTTP requests/users. */
export function withDashboardFilters(context, filters = {}) {
  const hasFilters = Object.keys(filters).length > 0;
  const cache = new Map();
  const now = new Date();
  const memo = (key, load) => {
    if (!cache.has(key)) cache.set(key, load());
    return cache.get(key);
  };
  const validateFilters = () => memo("validation", async () => {
    if (filters.serviceOrderStatus) validateDashboardOrderStatus(filters, await context.getServiceOrderSettings());
  });
  if (!hasFilters) return { ...context, filters, hasFilters, validateFilters };

  const getScope = () => memo("scope", async () => {
    await validateFilters();
    const [devices, activeAlerts, serviceOrders, settings] = await Promise.all([
      context.getDevices(),
      filters.alertSeverity ? context.getActiveAlerts() : [],
      hasOrderFilter(filters) ? context.getServiceOrders() : [],
      hasOrderFilter(filters) ? context.getServiceOrderSettings() : null
    ]);
    return buildDashboardAssetScope({ devices, activeAlerts, serviceOrders, settings }, filters, now);
  });
  const getAlerts = (key, load, requireKnownAsset = false) => memo(key, async () => {
    const [alerts, scope] = await Promise.all([load(), getScope()]);
    const matching = filterDashboardAlerts(alerts, filters, scope.assetIds);
    return requireKnownAsset ? matching.filter((alert) => scope.assetIds.has(alertAssetId(alert))) : matching;
  });
  const filteredContext = {
    ...context,
    filters,
    hasFilters,
    validateFilters,
    getDevices: () => memo("devices", async () => (await getScope()).devices),
    getScopedAssetIds: () => memo("assetIds", async () => (await getScope()).assetIds),
    getActiveAlerts: () => getAlerts("activeAlerts", context.getActiveAlerts),
    // Historical recurrences belong to the selected inventory, not unrelated
    // resolved alerts that happen to have the same severity.
    getAllAlerts: () => getAlerts("allAlerts", context.getAllAlerts, true),
    getServiceOrders: () => memo("orders", async () => {
      const [orders, scope, settings] = await Promise.all([
        context.getServiceOrders(), getScope(), context.getServiceOrderSettings()
      ]);
      return filterDashboardServiceOrders(orders, filters, scope.assetIds, settings, now);
    })
  };
  filteredContext.getScopedEventReferences = () => memo("eventReferences", async () => {
    const [assetIds, activeAlerts, allAlerts, orders] = await Promise.all([
      filteredContext.getScopedAssetIds(), filteredContext.getActiveAlerts(),
      filteredContext.getAllAlerts(), filteredContext.getServiceOrders()
    ]);
    return {
      assetIds,
      alertIds: new Set([...allAlerts, ...activeAlerts].filter((alert) => assetIds.has(alertAssetId(alert))).map((alert) => idOf(alert.id))),
      serviceOrderIds: new Set(orders.filter((order) => assetIds.has(idOf(order.assetId))).map((order) => idOf(order.id)))
    };
  });
  return filteredContext;
}
