export const CALENDAR_EVENT_TYPES = ["service_order", "preventive_maintenance", "technical_visit", "internal_task", "asset_check", "reminder", "other"];
export const CALENDAR_EVENT_STATUSES = ["scheduled", "in_progress", "completed", "cancelled", "missed"];
export const CALENDAR_EVENT_PRIORITIES = ["low", "normal", "high", "urgent"];

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function optionalText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function requiredDate(value, field) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw badRequest(`${field} deve ser uma data válida.`);
  return date;
}

export function validateCalendarPeriod(startDate, endDate, maxDays = 93) {
  const start = requiredDate(startDate, "startDate");
  const end = requiredDate(endDate, "endDate");
  if (end <= start) throw badRequest("endDate deve ser posterior a startDate.");
  if ((end - start) / 86_400_000 > maxDays) throw badRequest(`O período máximo de consulta é de ${maxDays} dias.`);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

export function validateCalendarEvent(payload = {}, { partial = false } = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const title = String(source.title ?? "").trim();
  if (!partial || Object.hasOwn(source, "title")) {
    if (title.length < 3 || title.length > 160) throw badRequest("Informe um título entre 3 e 160 caracteres.");
  }

  const eventType = source.eventType ?? source.event_type;
  if (!partial || eventType !== undefined) {
    if (!CALENDAR_EVENT_TYPES.includes(eventType)) throw badRequest("Tipo de evento inválido.");
  }
  const status = source.status ?? (partial ? undefined : "scheduled");
  if (status !== undefined && !CALENDAR_EVENT_STATUSES.includes(status)) throw badRequest("Status do evento inválido.");
  const priority = source.priority ?? (partial ? undefined : "normal");
  if (priority !== undefined && !CALENDAR_EVENT_PRIORITIES.includes(priority)) throw badRequest("Prioridade do evento inválida.");

  const startInput = source.startAt ?? source.start_at;
  const endInput = source.endAt ?? source.end_at;
  let startAt;
  let endAt;
  if (!partial || startInput !== undefined) startAt = requiredDate(startInput, "startAt").toISOString();
  if (endInput !== undefined && endInput !== null && endInput !== "") endAt = requiredDate(endInput, "endAt").toISOString();
  if (startAt && endAt && new Date(endAt) <= new Date(startAt)) throw badRequest("O término deve ser posterior ao início.");

  const result = {
    ...(title ? { title } : {}),
    ...(Object.hasOwn(source, "description") ? { description: String(source.description || "").trim().slice(0, 5000) } : {}),
    ...(eventType !== undefined ? { eventType } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(startAt ? { startAt } : {}),
    ...(endInput !== undefined ? { endAt: endAt || null } : {}),
    ...(!partial || Object.hasOwn(source, "allDay") ? { allDay: Boolean(source.allDay) } : {})
  };

  const optionalFields = [
    ["serviceOrderId", "service_order_id"], ["assetId", "asset_id"], ["technicianId", "technician_id"],
    ["segmentId", "segment_id"], ["groupId", "group_id"], ["environmentName", "environment_name"]
  ];
  for (const [camel, snake] of optionalFields) {
    if (!partial || Object.hasOwn(source, camel) || Object.hasOwn(source, snake)) result[camel] = optionalText(source[camel] ?? source[snake]);
  }
  if (!partial || Object.hasOwn(source, "metadata")) result.metadata = source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata) ? source.metadata : {};
  return result;
}
