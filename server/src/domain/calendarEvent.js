export const CALENDAR_EVENT_TYPES = ["service_order", "preventive_maintenance", "technical_visit", "internal_task", "asset_check", "reminder", "other"];
export const CALENDAR_EVENT_STATUSES = ["scheduled", "in_progress", "completed", "cancelled", "missed"];
export const CALENDAR_EVENT_PRIORITIES = ["low", "normal", "high", "urgent"];

/**
 * @param {string} message
 * @returns {import("../lib/errors.js").HttpErrorLike}
 */
function badRequest(message) {
  /** @type {import("../lib/errors.js").HttpErrorLike} */
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

/** @param {unknown} value */
function optionalText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {Date}
 */
function requiredDate(value, field) {
  const date = new Date(/** @type {string | number | Date} */ (value));
  if (!value || Number.isNaN(date.getTime())) throw badRequest(`${field} deve ser uma data válida.`);
  return date;
}

/**
 * @param {unknown} startDate
 * @param {unknown} endDate
 * @param {number} [maxDays]
 * @returns {{ startDate: string, endDate: string }}
 * @throws {import("../lib/errors.js").HttpErrorLike} 400 para datas invalidas, intervalo invertido ou acima de `maxDays`.
 */
export function validateCalendarPeriod(startDate, endDate, maxDays = 93) {
  const start = requiredDate(startDate, "startDate");
  const end = requiredDate(endDate, "endDate");
  if (end <= start) throw badRequest("endDate deve ser posterior a startDate.");
  if ((end.getTime() - start.getTime()) / 86_400_000 > maxDays) throw badRequest(`O período máximo de consulta é de ${maxDays} dias.`);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/**
 * Evento de agenda validado; so as chaves presentes no corpo (ou todas, se nao for parcial).
 * @typedef {object} ValidatedCalendarEvent
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [eventType]
 * @property {string} [status]
 * @property {string} [priority]
 * @property {string} [startAt] ISO 8601.
 * @property {string | null} [endAt] ISO 8601.
 * @property {boolean} [allDay]
 * @property {string | null} [serviceOrderId]
 * @property {string | null} [assetId]
 * @property {string | null} [technicianId]
 * @property {string | null} [segmentId]
 * @property {string | null} [groupId]
 * @property {string | null} [environmentName]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {unknown} [payload] Corpo da requisicao.
 * @param {{ partial?: boolean }} [options] Com `partial`, campos ausentes sao omitidos em vez de exigidos.
 * @returns {ValidatedCalendarEvent}
 * @throws {import("../lib/errors.js").HttpErrorLike} 400 para titulo, tipo, status, prioridade ou datas invalidos.
 */
export function validateCalendarEvent(payload = {}, { partial = false } = {}) {
  const source = /** @type {Record<string, unknown>} */ (payload && typeof payload === "object" ? payload : {});
  const title = String(source.title ?? "").trim();
  if (!partial || Object.hasOwn(source, "title")) {
    if (title.length < 3 || title.length > 160) throw badRequest("Informe um título entre 3 e 160 caracteres.");
  }

  // Valores fora das listas fechadas abaixo sao recusados com 400, entao o cast e seguro.
  const eventType = /** @type {string | undefined} */ (source.eventType ?? source.event_type);
  if (!partial || eventType !== undefined) {
    if (!eventType || !CALENDAR_EVENT_TYPES.includes(eventType)) throw badRequest("Tipo de evento inválido.");
  }
  const status = /** @type {string | undefined} */ (source.status ?? (partial ? undefined : "scheduled"));
  if (status !== undefined && !CALENDAR_EVENT_STATUSES.includes(status)) throw badRequest("Status do evento inválido.");
  const priority = /** @type {string | undefined} */ (source.priority ?? (partial ? undefined : "normal"));
  if (priority !== undefined && !CALENDAR_EVENT_PRIORITIES.includes(priority)) throw badRequest("Prioridade do evento inválida.");

  const startInput = source.startAt ?? source.start_at;
  const endInput = source.endAt ?? source.end_at;
  /** @type {string | undefined} */
  let startAt;
  /** @type {string | undefined} */
  let endAt;
  if (!partial || startInput !== undefined) startAt = requiredDate(startInput, "startAt").toISOString();
  if (endInput !== undefined && endInput !== null && endInput !== "") endAt = requiredDate(endInput, "endAt").toISOString();
  if (startAt && endAt && new Date(endAt) <= new Date(startAt)) throw badRequest("O término deve ser posterior ao início.");

  /** @type {ValidatedCalendarEvent} */
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

  /** @type {Array<["serviceOrderId" | "assetId" | "technicianId" | "segmentId" | "groupId" | "environmentName", string]>} */
  const optionalFields = [
    ["serviceOrderId", "service_order_id"], ["assetId", "asset_id"], ["technicianId", "technician_id"],
    ["segmentId", "segment_id"], ["groupId", "group_id"], ["environmentName", "environment_name"]
  ];
  for (const [camel, snake] of optionalFields) {
    if (!partial || Object.hasOwn(source, camel) || Object.hasOwn(source, snake)) result[camel] = optionalText(source[camel] ?? source[snake]);
  }
  if (!partial || Object.hasOwn(source, "metadata")) result.metadata = source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata) ? /** @type {Record<string, unknown>} */ (source.metadata) : {};
  return result;
}
