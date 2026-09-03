import { hasPermission } from "../permissions.js";
import { validateCalendarEvent, validateCalendarPeriod } from "../domain/calendarEvent.js";
import {
  assertCalendarReferences, cancelCalendarEvent, createCalendarEvent, deleteCalendarEvent,
  getCalendarEvent, listCalendarEvents, updateCalendarEvent
} from "../repositories/calendarRepository.js";

function filtersFromQuery(query) {
  const period = validateCalendarPeriod(query.startDate, query.endDate);
  return { ...period, technicianId: query.technicianId, eventType: query.eventType, status: query.status, priority: query.priority, serviceOrderId: query.serviceOrderId, assetId: query.assetId, segmentId: query.segmentId, groupId: query.groupId };
}

async function assertEventAccess(id, user) {
  const event = await getCalendarEvent(id);
  if (hasPermission(user, "calendar.view_all_technicians") || event.createdBy === user.id || (event.technicianEmail && event.technicianEmail.toLowerCase() === String(user.email || "").toLowerCase()) || (event.technicianName && event.technicianName.toLowerCase() === String(user.name || "").toLowerCase())) return event;
  const error = new Error("Você não possui acesso a este agendamento.");
  error.statusCode = 403;
  throw error;
}

function assertTechnicianAssignment(payload, user, current = null) {
  if (payload.technicianId && payload.technicianId !== current?.technicianId && !hasPermission(user, "calendar.assign_technician")) {
    const error = new Error("Você não possui permissão para atribuir técnicos.");
    error.statusCode = 403;
    throw error;
  }
}

export function listEvents(query, user) {
  return listCalendarEvents(filtersFromQuery(query), user, hasPermission(user, "calendar.view_all_technicians"));
}
export function eventDetails(id, user) { return assertEventAccess(id, user); }
export async function createEvent(payload, user) {
  const clean = validateCalendarEvent(payload);
  assertTechnicianAssignment(clean, user);
  await assertCalendarReferences(clean);
  return createCalendarEvent(clean, user);
}
export async function updateEvent(id, payload, user) {
  const clean = validateCalendarEvent(payload, { partial: true });
  const current = await assertEventAccess(id, user);
  assertTechnicianAssignment(clean, user, current);
  const merged = validateCalendarEvent({ ...current, ...clean });
  await assertCalendarReferences(merged);
  return updateCalendarEvent(id, clean, user);
}
export async function cancelEvent(id, reason, user) { await assertEventAccess(id, user); return cancelCalendarEvent(id, reason, user); }
export async function removeEvent(id, user) { await assertEventAccess(id, user); return deleteCalendarEvent(id); }
export async function calendarSummary(query, user) {
  const events = await listEvents(query, user);
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  return {
    total: events.length,
    today: events.filter((event) => String(event.startAt).slice(0, 10) === today && event.status !== "cancelled").length,
    overdue: events.filter((event) => new Date(event.startAt).getTime() < now && event.status === "scheduled").length,
    serviceOrders: events.filter((event) => event.eventType === "service_order" && event.status !== "cancelled").length,
    preventiveMaintenance: events.filter((event) => event.eventType === "preventive_maintenance" && event.status !== "cancelled").length,
    technicalVisits: events.filter((event) => event.eventType === "technical_visit" && event.status !== "cancelled").length,
    busyTechnicians: new Set(events.filter((event) => event.technicianId && event.status !== "cancelled").map((event) => event.technicianId)).size,
    upcoming: events.filter((event) => new Date(event.startAt).getTime() >= now && event.status === "scheduled").slice(0, 5)
  };
}
