// Regras puras de hierarquia (aba > grupo > segmento > ativo) e de elegibilidade usadas pela agenda.
import { toLocalInput } from "../calendarModel.js";

export function normalizedName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export function isMaintenanceSegment(segment) {
  return normalizedName(segment?.name) === "manutencao";
}

const FINALIZED_STATUSES = [
  "closed",
  "completed",
  "finalized",
  "finished",
  "resolved",
  "concluida",
  "concluido",
  "finalizada",
  "finalizado"
];

export function isFinalizedServiceOrder(order) {
  return Boolean(order?.closedAt) || FINALIZED_STATUSES.includes(normalizedName(order?.status));
}

export function selectableServiceOrders(serviceOrders) {
  return serviceOrders.filter((item) => !isFinalizedServiceOrder(item));
}

export function selectableSegmentsOf(segments) {
  return segments.filter((item) => !item.isDefault && !isMaintenanceSegment(item));
}

// Opcoes dependentes do formulario: cada nivel so lista filhos do nivel escolhido acima.
export function hierarchyOptions(form, { groups, segments, devices }) {
  const groupsForTab = form.tabId ? groups.filter((item) => item.tabId === form.tabId) : [];
  const segmentsForGroup = form.groupId
    ? selectableSegmentsOf(segments).filter((item) => item.groupId === form.groupId && (!form.tabId || item.tabId === form.tabId))
    : [];
  const devicesForSegment = form.segmentId ? devices.filter((item) => item.segmentId === form.segmentId) : [];
  return { groupsForTab, segmentsForGroup, devicesForSegment };
}

// Quando o formulario ja aponta para um ativo/segmento/grupo mas ainda nao tem aba, deduz a aba e os pais.
// Retorna null quando nao ha nada a preencher.
export function inferHierarchyPatch({ assetId, groupId, segmentId, tabId: currentTabId }, { devices, segments, groups }) {
  const selectedDevice = devices.find((item) => item.id === assetId);
  const selectedSegment = segments.find((item) => item.id === (selectedDevice?.segmentId || segmentId));
  const selectedGroup = groups.find((item) => item.id === (selectedSegment?.groupId || groupId));
  const tabId = selectedDevice?.tabId || selectedSegment?.tabId || selectedGroup?.tabId || "";
  if (currentTabId || !tabId) return null;
  return { tabId, groupId: selectedSegment?.groupId || "", segmentId: selectedDevice?.segmentId || "" };
}

export function applyInferredHierarchy(current, patch) {
  return {
    ...current,
    tabId: patch.tabId,
    groupId: current.groupId || patch.groupId,
    segmentId: current.segmentId || patch.segmentId
  };
}

export function applyHierarchySelection(current, field, value) {
  if (field === "tabId") return { ...current, tabId: value, groupId: "", segmentId: "", assetId: "" };
  if (field === "groupId") return { ...current, groupId: value, segmentId: "", assetId: "" };
  if (field === "segmentId") return { ...current, segmentId: value, assetId: "" };
  return { ...current, [field]: value };
}

export function applyServiceOrderSelection(current, serviceOrderId, { orders, devices, segments, groups }) {
  const order = orders.find((item) => item.id === serviceOrderId);
  const device = devices.find((item) => item.id === order?.assetId);
  const segment = segments.find((item) => item.id === device?.segmentId);
  const group = groups.find((item) => item.id === segment?.groupId);
  return {
    ...current,
    serviceOrderId,
    assetId: device?.id || current.assetId,
    segmentId: segment && !isMaintenanceSegment(segment) ? segment.id : current.segmentId,
    groupId: group?.id || current.groupId,
    tabId: device?.tabId || segment?.tabId || group?.tabId || current.tabId
  };
}

export function initialEventForm(event, selectedDate, defaults = {}) {
  const start =
    event?.startAt ||
    defaults.startAt ||
    (() => {
      const date = new Date(selectedDate || Date.now());
      date.setHours(9, 0, 0, 0);
      return date;
    })();
  const end = event?.endAt || new Date(new Date(start).getTime() + 60 * 60_000);
  return {
    title: event?.title || defaults.title || "",
    eventType: event?.eventType || defaults.eventType || "technical_visit",
    status: event?.status || "scheduled",
    priority: event?.priority || "normal",
    startAt: toLocalInput(start),
    endAt: toLocalInput(end),
    allDay: Boolean(event?.allDay),
    technicianId: event?.technicianId || defaults.technicianId || "",
    serviceOrderId: event?.serviceOrderId || defaults.serviceOrderId || "",
    assetId: event?.assetId || defaults.assetId || "",
    tabId: "",
    segmentId: event?.segmentId || "",
    groupId: event?.groupId || "",
    description: event?.description || ""
  };
}

// A aba e so um auxiliar de navegacao do formulario: nao faz parte do que o servidor recebe.
export function buildEventPayload(form) {
  const payload = { ...form };
  delete payload.tabId;
  return {
    ...payload,
    environmentName: null,
    startAt: new Date(form.startAt).toISOString(),
    endAt: form.endAt ? new Date(form.endAt).toISOString() : null
  };
}
