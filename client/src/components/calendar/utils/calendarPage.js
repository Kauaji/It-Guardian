// Utilitarios puros da pagina da agenda: filtros, parametros de consulta, busca local e apresentacao do dia.
import { dateKey, PRIORITY_META } from "../calendarModel.js";
import { isMaintenanceSegment } from "./calendarHierarchy.js";

export const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const EMPTY_FILTERS = {
  technicianId: "",
  eventType: "",
  status: "",
  priority: "",
  groupId: "",
  segmentId: "",
  serviceOrderId: "",
  search: ""
};

export function formatHeader(anchor) {
  return anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function shiftMonth(anchor, direction) {
  const next = new Date(anchor);
  next.setMonth(next.getMonth() + direction);
  return next;
}

export function filterSegmentsFor(segments, groupId) {
  return segments
    .filter((segment) => !segment.isDefault && !isMaintenanceSegment(segment))
    .filter((segment) => !groupId || !segment.groupId || segment.groupId === groupId);
}

export function countActiveFilters(filters) {
  return Object.entries(filters).filter(([key, value]) => key !== "search" && value).length;
}

// A busca textual e local: nao viaja na consulta ao servidor.
export function buildQueryParams(range, filters) {
  return {
    startDate: range.start.toISOString(),
    endDate: range.end.toISOString(),
    ...Object.fromEntries(Object.entries(filters).filter(([key, value]) => value && key !== "search"))
  };
}

export function filterEventsBySearch(events, rawSearch) {
  const search = rawSearch.trim().toLocaleLowerCase("pt-BR");
  if (!search) return events;
  return events.filter((event) =>
    [event.title, event.description, event.serviceOrderNumber, event.technicianName].some((value) =>
      String(value || "")
        .toLocaleLowerCase("pt-BR")
        .includes(search)
    )
  );
}

export function buildServiceOrderDefaults(order) {
  return {
    title: `Atendimento ${order.number} · ${order.title}`,
    eventType: "service_order",
    serviceOrderId: order.id,
    assetId: order.assetId || ""
  };
}

export function highestPriority(events) {
  return events.reduce(
    (highest, event) => ((PRIORITY_META[event.priority]?.rank || 0) > (PRIORITY_META[highest]?.rank || 0) ? event.priority : highest),
    ""
  );
}

export function dayPriorityColor(events) {
  const priority = highestPriority(events);
  return priority ? PRIORITY_META[priority].color : "transparent";
}

export function dayCellClassName(day, anchor, dayEvents) {
  const outside = day.getMonth() !== anchor.getMonth();
  const past = day < new Date(new Date().setHours(0, 0, 0, 0));
  return `calendar-day-cell ${outside ? "outside" : ""} ${past ? "past" : ""} ${dayEvents.length ? "has-events" : ""} ${dateKey(day) === dateKey(new Date()) ? "today" : ""}`;
}

export function formatEventTime(event) {
  return event.allDay ? "Dia" : new Date(event.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
