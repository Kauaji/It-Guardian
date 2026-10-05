/** @import { NormalizedSchedule, ScheduleSource } from "./preventiveTypes.js" */

const recurrenceTypes = new Set(["daily", "weekly", "biweekly", "monthly", "custom_days"]);
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";
export const DEFAULT_PREFERRED_TIME = "08:00";

export const recurrenceIntervalDefaults = {
  daily: 1,
  weekly: 7,
  biweekly: 15,
  monthly: 30,
  custom_days: 30
};

/** @param {string} message */
function validationError(message) {
  /** @type {import("../lib/errors.js").HttpErrorLike} */
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

/**
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string} Um de daily, weekly, biweekly, monthly, custom_days (ou `fallback`).
 */
export function normalizeRecurrenceType(value, fallback = "monthly") {
  const normalized = String(value || "").trim().toLowerCase();
  return recurrenceTypes.has(normalized) ? normalized : fallback;
}

/** @param {unknown} type */
export function defaultIntervalForType(type) {
  const defaults = /** @type {Record<string, number>} */ (recurrenceIntervalDefaults);
  return defaults[normalizeRecurrenceType(type)] || recurrenceIntervalDefaults.monthly;
}

/**
 * Dias entre execucoes: fixo para tipos nao personalizados; 1..365 para `custom_days`.
 *
 * @param {unknown} value
 * @param {unknown} [type]
 * @param {{ strict?: boolean }} [options] Com `strict`, valor invalido de `custom_days` lanca 400.
 * @returns {number}
 */
export function normalizeRecurrenceIntervalDays(value, type = "monthly", options = {}) {
  const recurrenceType = normalizeRecurrenceType(type);
  if (recurrenceType !== "custom_days") return defaultIntervalForType(recurrenceType);

  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 365) return parsed;
  if (options.strict) throw validationError("Informe a quantidade de dias da recorrência personalizada.");
  return defaultIntervalForType(recurrenceType);
}

/**
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string} `HH:MM`.
 */
export function normalizePreferredTime(value, fallback = DEFAULT_PREFERRED_TIME) {
  const text = String(value ?? "").trim().slice(0, 5) || fallback;
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

/**
 * @param {unknown} value Nome IANA.
 * @param {string} [fallback]
 * @returns {string}
 */
export function normalizeTimezone(value, fallback = DEFAULT_TIMEZONE) {
  const timezone = String(value ?? "").trim().slice(0, 80) || fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return fallback;
  }
}

/**
 * @param {Date | string | number} [value]
 * @returns {Date} A data recebida ou "agora" quando invalida.
 */
export function toValidDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** @param {unknown} value */
function parsePreferredTime(value) {
  const [hour, minute] = normalizePreferredTime(value).split(":").map(Number);
  return { hour, minute };
}

/**
 * @param {Date} date
 * @param {string} timeZone
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number }}
 */
function getZonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  /** @type {Record<string, number>} */
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)])
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

/**
 * @param {Date} date
 * @param {string} timeZone
 */
function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getZonedDateParts(date, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0) - date.getTime();
}

/**
 * @param {{ year: number, month: number, day: number, hour: number, minute: number, second?: number }} local
 * @param {string} timeZone
 * @returns {Date}
 */
function zonedDateTimeToUtc({ year, month, day, hour, minute, second = 0 }, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const firstUtc = utcGuess - getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - getTimeZoneOffsetMs(new Date(firstUtc), timeZone));
}

/**
 * @param {{ year: number, month: number, day: number }} parts
 * @param {number} days
 */
function addDaysToLocalDateParts(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

/**
 * @param {ScheduleSource} [source] Aceita camelCase e snake_case.
 * @returns {NormalizedSchedule}
 */
export function normalizePreventiveSchedule(source = {}) {
  const recurrenceType = normalizeRecurrenceType(source.recurrenceType || source.recurrence_type);
  return {
    recurrenceType,
    recurrenceIntervalDays: normalizeRecurrenceIntervalDays(
      source.recurrenceIntervalDays ?? source.recurrenceInterval ?? source.recurrence_interval,
      recurrenceType
    ),
    preferredTime: normalizePreferredTime(source.preferredTime || source.preferred_time),
    timezone: normalizeTimezone(source.timezone || source.time_zone)
  };
}

/**
 * @param {unknown} type
 * @param {unknown} interval
 */
export function recurrenceToDays(type, interval) {
  return normalizeRecurrenceIntervalDays(interval, type);
}

/**
 * Proxima ocorrencia (ISO) no horario preferido do fuso do plano.
 *
 * @param {ScheduleSource} source
 * @param {Date | string | number} [fromDate]
 * @returns {string}
 */
export function computeNextScheduledFor(source, fromDate = new Date()) {
  const schedule = normalizePreventiveSchedule(source);
  const baseDate = toValidDate(fromDate);
  const localParts = getZonedDateParts(baseDate, schedule.timezone);
  const preferred = parsePreferredTime(schedule.preferredTime);
  let candidate = zonedDateTimeToUtc({ ...localParts, hour: preferred.hour, minute: preferred.minute }, schedule.timezone);

  if (candidate <= baseDate) {
    candidate = zonedDateTimeToUtc(
      {
        ...addDaysToLocalDateParts(localParts, schedule.recurrenceIntervalDays),
        hour: preferred.hour,
        minute: preferred.minute
      },
      schedule.timezone
    );
  }

  return candidate.toISOString();
}

/**
 * @param {ScheduleSource} source
 * @param {Date | string | number} scheduledFor
 * @returns {string}
 */
export function computeFollowingScheduledFor(source, scheduledFor) {
  return computeNextScheduledFor(source, toValidDate(scheduledFor));
}
