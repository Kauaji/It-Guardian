import { normalizeBoolean } from "../../lib/textUtils.js";

export const defaultAlertRules = [
  {
    id: "rule-ram-high",
    type: "ram_high",
    metric: "ram",
    threshold: 90,
    durationMinutes: 5,
    recurrenceCount: 3,
    recurrenceWindow: "same_day",
    suggestedPriority: "high",
    createsSuggestion: true,
    enabled: true
  },
  {
    id: "rule-cpu-high",
    type: "cpu_high",
    metric: "cpu",
    threshold: 90,
    durationMinutes: 5,
    recurrenceCount: 3,
    recurrenceWindow: "same_day",
    suggestedPriority: "high",
    createsSuggestion: true,
    enabled: true
  },
  {
    id: "rule-disk-high",
    type: "disk_high",
    metric: "disk",
    threshold: 85,
    durationMinutes: 5,
    recurrenceCount: 3,
    recurrenceWindow: "same_day",
    suggestedPriority: "high",
    createsSuggestion: true,
    enabled: true
  },
  {
    id: "rule-disk-full",
    type: "disk_full",
    metric: "disk",
    threshold: 95,
    durationMinutes: 0,
    recurrenceCount: 1,
    recurrenceWindow: "last_24h",
    suggestedPriority: "critical",
    createsSuggestion: true,
    enabled: true
  },
  {
    id: "rule-disk-health-low",
    type: "disk_health_low",
    metric: "disk_health",
    threshold: 80,
    durationMinutes: 0,
    recurrenceCount: 1,
    recurrenceWindow: "last_24h",
    suggestedPriority: "critical",
    createsSuggestion: true,
    enabled: true
  },
  {
    id: "rule-machine-offline",
    type: "machine_offline",
    metric: "availability",
    threshold: 0,
    durationMinutes: 5,
    recurrenceCount: 2,
    recurrenceWindow: "same_day",
    suggestedPriority: "critical",
    createsSuggestion: true,
    enabled: true
  },
  {
    id: "rule-network-high",
    type: "network_high",
    metric: "network",
    threshold: 85,
    durationMinutes: 5,
    recurrenceCount: 3,
    recurrenceWindow: "same_day",
    suggestedPriority: "medium",
    createsSuggestion: true,
    enabled: true
  },
  {
    id: "rule-temperature-high",
    type: "temperature_high",
    metric: "temperature",
    threshold: 80,
    durationMinutes: 5,
    recurrenceCount: 2,
    recurrenceWindow: "last_24h",
    suggestedPriority: "high",
    createsSuggestion: true,
    enabled: true
  },
  {
    id: "rule-ping-failure",
    type: "ping_failure",
    metric: "ping",
    threshold: 0,
    durationMinutes: 5,
    recurrenceCount: 3,
    recurrenceWindow: "same_day",
    suggestedPriority: "high",
    createsSuggestion: true,
    enabled: true
  },
  {
    id: "rule-service-unavailable",
    type: "service_unavailable",
    metric: "service",
    threshold: 0,
    durationMinutes: 5,
    recurrenceCount: 2,
    recurrenceWindow: "last_24h",
    suggestedPriority: "critical",
    createsSuggestion: true,
    enabled: true
  }
];

const allowedPriorities = new Set(["low", "medium", "high", "critical"]);

const defaultAlertPriorityColors = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#ea580c",
  critical: "#dc2626"
};

export const defaultAlertSettings = {
  rejectedAlertSilenceHours: 24,
  recurrenceCounterResetHours: 24,
  inactiveAlertAutoResolveHours: 48,
  preventiveDueDays: 180,
  scriptValidationWindowMinutes: 30,
  autoPriority: {
    enabled: true,
    lowToMediumHours: 24,
    mediumToHighHours: 48,
    highToCriticalHours: 72
  },
  priorityColors: defaultAlertPriorityColors
};

export function toNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizePriority(value, fallback = "medium") {
  const priority = String(value || "").trim().toLowerCase();
  return allowedPriorities.has(priority) ? priority : fallback;
}

function sanitizeColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

export function normalizeAlertSettings(value = {}) {
  const autoPriority = value.autoPriority || {};
  const priorityColors = value.priorityColors || {};
  const rejectedAlertSilenceHours = Math.max(
    1,
    toNumber(value.rejectedAlertSilenceHours ?? value.rejectionSilenceHours, defaultAlertSettings.rejectedAlertSilenceHours)
  );
  const recurrenceCounterResetHours = Math.max(
    1,
    toNumber(value.recurrenceCounterResetHours ?? value.recurrenceCounterWindow, defaultAlertSettings.recurrenceCounterResetHours)
  );
  const inactiveAlertAutoResolveHours = Math.max(
    1,
    toNumber(value.inactiveAlertAutoResolveHours, defaultAlertSettings.inactiveAlertAutoResolveHours)
  );
  const preventiveDueDays = Math.max(
    1,
    toNumber(value.preventiveDueDays, defaultAlertSettings.preventiveDueDays)
  );
  const scriptValidationWindowMinutes = Math.min(
    10080,
    Math.max(
      5,
      toNumber(value.scriptValidationWindowMinutes, defaultAlertSettings.scriptValidationWindowMinutes)
    )
  );

  return {
    rejectedAlertSilenceHours,
    recurrenceCounterResetHours,
    inactiveAlertAutoResolveHours,
    preventiveDueDays,
    scriptValidationWindowMinutes,
    autoPriority: {
      enabled: normalizeBoolean(autoPriority.enabled, defaultAlertSettings.autoPriority.enabled),
      lowToMediumHours: Math.max(1, toNumber(autoPriority.lowToMediumHours, defaultAlertSettings.autoPriority.lowToMediumHours)),
      mediumToHighHours: Math.max(1, toNumber(autoPriority.mediumToHighHours, defaultAlertSettings.autoPriority.mediumToHighHours)),
      highToCriticalHours: Math.max(1, toNumber(autoPriority.highToCriticalHours, defaultAlertSettings.autoPriority.highToCriticalHours))
    },
    priorityColors: Object.fromEntries(
      Object.entries(defaultAlertPriorityColors).map(([priority, fallback]) => [
        priority,
        sanitizeColor(priorityColors[priority], fallback)
      ])
    )
  };
}

export function normalizeSuggestionStatusAfterObservation(currentStatus, observationStatus) {
  if (currentStatus === "accepted" || currentStatus === "rejected") return currentStatus;
  if (observationStatus === "observed_resolved") return "resolved";
  return "pending";
}

function hasOwn(payload, key) {
  return Object.prototype.hasOwnProperty.call(payload, key);
}

/** Combina o payload parcial com as configuracoes atuais e normaliza (funcao pura). */
export function mergeAlertSettingsUpdate(current, payload = {}) {
  return normalizeAlertSettings({
    rejectedAlertSilenceHours:
      payload.rejectedAlertSilenceHours ?? current.rejectedAlertSilenceHours,
    recurrenceCounterResetHours:
      payload.recurrenceCounterResetHours ?? current.recurrenceCounterResetHours,
    inactiveAlertAutoResolveHours:
      payload.inactiveAlertAutoResolveHours ?? current.inactiveAlertAutoResolveHours,
    preventiveDueDays:
      payload.preventiveDueDays ?? current.preventiveDueDays,
    scriptValidationWindowMinutes:
      payload.scriptValidationWindowMinutes ?? current.scriptValidationWindowMinutes,
    autoPriority: {
      ...current.autoPriority,
      ...(payload.autoPriority || {})
    },
    priorityColors: {
      ...current.priorityColors,
      ...(payload.priorityColors || {})
    }
  });
}

/**
 * Valores novos de uma regra de aviso a partir da linha atual (colunas do
 * banco) e do payload parcial: so campos enviados mudam (funcao pura).
 */
export function buildAlertRuleUpdate(current, payload = {}) {
  return {
    threshold: hasOwn(payload, "threshold")
      ? toNumber(payload.threshold, current.threshold)
      : current.threshold,
    durationMinutes: hasOwn(payload, "durationMinutes")
      ? Math.max(0, Math.round(toNumber(payload.durationMinutes, current.duration_minutes)))
      : current.duration_minutes,
    recurrenceCount: hasOwn(payload, "recurrenceCount")
      ? Math.max(1, Math.round(toNumber(payload.recurrenceCount, current.recurrence_count)))
      : current.recurrence_count,
    recurrenceWindow: String(payload.recurrenceWindow || current.recurrence_window || "same_day").trim(),
    suggestedPriority: hasOwn(payload, "suggestedPriority")
      ? normalizePriority(payload.suggestedPriority, current.suggested_priority)
      : normalizePriority(current.suggested_priority),
    createsSuggestion: normalizeBoolean(payload.createsSuggestion, current.creates_suggestion),
    enabled: normalizeBoolean(payload.enabled, current.enabled)
  };
}

/** Comentario de aviso: obrigatorio, limitado a 1000 caracteres (funcao pura). */
export function normalizeAlertComment(message) {
  const cleanMessage = String(message || "").trim();

  if (!cleanMessage) {
    const error = new Error("Informe um comentário para registrar no aviso.");
    error.statusCode = 400;
    throw error;
  }

  return cleanMessage.slice(0, 1000);
}

/**
 * Decide o que fazer ao gerar sugestao para um aviso que ja tem sugestao:
 * aceita -> nada; recusada e ainda silenciada -> ignora; demais -> reabre/atualiza.
 */
export function decideSuggestionRefresh(existing, now = Date.now()) {
  if (existing.status === "accepted") return "skip_accepted";
  const silenceUntil = existing.rejection_silence_until || existing.ignored_until;
  const isStillSilenced = silenceUntil && new Date(silenceUntil).getTime() > now;
  if (existing.status === "rejected" && isStillSilenced) return "skip_silenced";
  return "refresh";
}
