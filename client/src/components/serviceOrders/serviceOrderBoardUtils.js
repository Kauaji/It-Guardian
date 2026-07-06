export const defaultPriorityColors = {
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

export const defaultServiceOrderSettings = {
  numberFormat: { prefix: "OS", useYear: false, useMonth: false, nextNumber: "" },
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

export const settingsTabs = [
  { id: "general", label: "Geral" },
  { id: "clients", label: "Clientes" },
  { id: "technicians", label: "Técnicos" },
  { id: "products", label: "Peças" },
  { id: "services", label: "Serviços" },
  { id: "problemTypes", label: "Tipos de problema" }
];

export const maxServiceOrderStatuses = 10;
export const generalSector = { id: "sector-geral", name: "Geral", active: true };
export const priorityLabels = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica"
};

export function formatDate(value) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function getMonthValue(value) {
  if (typeof value === "string") {
    const isoDate = value.match(/^(\d{4})-(\d{2})-\d{2}(?:T|$)/);
    const month = Number(isoDate?.[2]);
    if (isoDate && month >= 1 && month <= 12 && !Number.isNaN(new Date(value).getTime())) {
      return `${isoDate[1]}-${isoDate[2]}`;
    }
  }

  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getCurrentBrowserMonth() {
  return getMonthValue(new Date());
}

export function normalizeSearchText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function normalizeSectorList(sectors = []) {
  const byId = new Map([[generalSector.id, generalSector]]);
  for (const sector of sectors) {
    if (sector?.id) byId.set(sector.id, sector);
  }
  return [...byId.values()].filter((sector) => sector.active !== false);
}

export function orderBelongsToSector(order, sectorId) {
  if (sectorId === generalSector.id) {
    return !order.sectorId || order.sectorId === generalSector.id || order.sectorName === generalSector.name;
  }
  return order.sectorId === sectorId;
}

export function orderBelongsToClient(order, clientId) {
  return !clientId || clientId === "all" || order.environmentId === clientId;
}

export function getServiceLabel(order = {}) {
  if (order.serviceCode && order.serviceName) return `${order.serviceCode} - ${order.serviceName}`;
  return order.serviceName || order.serviceCode || order.servicePerformed || "";
}

export function formatMonthFilterLabel(value) {
  if (!value) return "Todos os meses";
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Selecionar mês";
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatShortMonth(value) {
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "").toUpperCase();
}

export function buildServiceOrderNumberPreview(settings) {
  const numberFormat = settings.numberFormat || defaultServiceOrderSettings.numberFormat;
  const prefix = String(numberFormat.prefix || "OS").trim().toUpperCase() || "OS";
  const sequence = Number(numberFormat.nextNumber) || 1;
  const now = new Date();
  return [
    prefix,
    numberFormat.useYear ? now.getFullYear() : "",
    numberFormat.useMonth ? String(now.getMonth() + 1).padStart(2, "0") : "",
    String(sequence).padStart(4, "0")
  ].filter(Boolean).join("-");
}

export function normalizeStatuses(statuses = []) {
  const source = Array.isArray(statuses) && statuses.length ? statuses : defaultServiceOrderStatuses;
  const seen = new Set();
  const normalized = source.map((status, index) => {
    const fallback = defaultServiceOrderStatuses[index] || defaultServiceOrderStatuses.at(-1);
    const id = String(status.id || status.value || fallback.id).trim() || fallback.id;
    if (seen.has(id)) return null;
    seen.add(id);
    return {
      id,
      name: String(status.name || status.label || fallback.name).trim() || fallback.name,
      color: /^#[0-9a-f]{6}$/i.test(status.color || "") ? status.color : fallback.color,
      order: Number.isFinite(Number(status.order)) ? Number(status.order) : index,
      isInitial: Boolean(status.isInitial),
      isFinal: Boolean(status.isFinal)
    };
  }).filter(Boolean);

  for (const status of defaultServiceOrderStatuses) {
    if (normalized.length >= 2) break;
    if (!seen.has(status.id)) normalized.push({ ...status });
  }
  normalized.sort((left, right) => left.order - right.order);

  let initialIndex = normalized.findIndex((status) => status.isInitial);
  if (initialIndex < 0) initialIndex = Math.max(0, normalized.findIndex((status) => status.id === "open"));
  let finalIndex = normalized.findIndex((status) => status.isFinal);
  if (finalIndex < 0) finalIndex = normalized.findIndex((status) => status.id === "closed");
  if (finalIndex < 0) finalIndex = normalized.length - 1;
  if (normalized.length > 1 && finalIndex === initialIndex) {
    finalIndex = normalized.findIndex((_status, index) => index !== initialIndex);
  }

  return normalized.map((status, index) => ({
    ...status,
    order: index,
    isInitial: index === initialIndex,
    isFinal: index === finalIndex
  }));
}

export function mergeServiceOrderSettings(settings = {}) {
  return {
    numberFormat: { ...defaultServiceOrderSettings.numberFormat, ...(settings.numberFormat || {}) },
    autoPriority: { ...defaultServiceOrderSettings.autoPriority, ...(settings.autoPriority || {}) },
    statuses: normalizeStatuses(settings.statuses),
    priorityColors: { ...defaultPriorityColors, ...(settings.priorityColors || {}) },
    boardLayout: settings.boardLayout === "vertical" ? "vertical" : "horizontal"
  };
}
