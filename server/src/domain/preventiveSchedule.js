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

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function normalizeRecurrenceType(value, fallback = "monthly") {
  const normalized = String(value || "").trim().toLowerCase();
  return recurrenceTypes.has(normalized) ? normalized : fallback;
}

export function defaultIntervalForType(type) {
  return recurrenceIntervalDefaults[normalizeRecurrenceType(type)] || recurrenceIntervalDefaults.monthly;
}

export function normalizeRecurrenceIntervalDays(value, type = "monthly", options = {}) {
  const recurrenceType = normalizeRecurrenceType(type);
  if (recurrenceType !== "custom_days") return defaultIntervalForType(recurrenceType);

  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 365) return parsed;
  if (options.strict) throw validationError("Informe a quantidade de dias da recorrência personalizada.");
  return defaultIntervalForType(recurrenceType);
}

export function normalizePreferredTime(value, fallback = DEFAULT_PREFERRED_TIME) {
  const text = String(value ?? "").trim().slice(0, 5) || fallback;
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

export function normalizeTimezone(value, fallback = DEFAULT_TIMEZONE) {
  const timezone = String(value ?? "").trim().slice(0, 80) || fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return fallback;
  }
}

function toValidDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parsePreferredTime(value) {
  const [hour, minute] = normalizePreferredTime(value).split(":").map(Number);
  return { hour, minute };
}

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

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getZonedDateParts(date, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0) - date.getTime();
}

function zonedDateTimeToUtc({ year, month, day, hour, minute, second = 0 }, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const firstUtc = utcGuess - getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - getTimeZoneOffsetMs(new Date(firstUtc), timeZone));
}

function addDaysToLocalDateParts(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

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

export function recurrenceToDays(type, interval) {
  return normalizeRecurrenceIntervalDays(interval, type);
}

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

export function computeFollowingScheduledFor(source, scheduledFor) {
  return computeNextScheduledFor(source, toValidDate(scheduledFor));
}
