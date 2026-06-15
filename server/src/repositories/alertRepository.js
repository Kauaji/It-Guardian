import { randomUUID } from "node:crypto";
import { query } from "../database.js";

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
    threshold: 90,
    durationMinutes: 5,
    recurrenceCount: 3,
    recurrenceWindow: "same_day",
    suggestedPriority: "high",
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

const defaultAlertSettings = {
  rejectedAlertSilenceHours: 24,
  recurrenceCounterResetHours: 24,
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

function toNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "false") return false;
  if (value === "true") return true;
  return fallback;
}

function normalizePriority(value, fallback = "medium") {
  const priority = String(value || "").trim().toLowerCase();
  return allowedPriorities.has(priority) ? priority : fallback;
}

function sanitizeColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizeAlertSettings(value = {}) {
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

function fromRuleRow(row) {
  return {
    id: row.id,
    type: row.type,
    metric: row.metric,
    threshold: toNumber(row.threshold),
    durationMinutes: toNumber(row.duration_minutes, 0),
    recurrenceCount: toNumber(row.recurrence_count, 1),
    recurrenceWindow: row.recurrence_window,
    suggestedPriority: normalizePriority(row.suggested_priority),
    createsSuggestion: row.creates_suggestion,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromAlertRow(row) {
  return {
    id: row.id,
    hostId: row.asset_id,
    assetId: row.asset_id,
    hostName: row.host_name,
    type: row.type,
    metric: row.metric,
    title: row.title,
    description: row.description,
    severity: row.severity,
    value: toNumber(row.value),
    threshold: toNumber(row.threshold),
    status: row.status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    startedAt: row.first_seen_at,
    resolvedAt: row.status === "resolved" ? row.last_seen_at : null,
    occurrencesCount: toNumber(row.occurrences_count, 1),
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromSuggestionRow(row) {
  return {
    id: row.id,
    alertId: row.alert_id,
    assetId: row.asset_id,
    title: row.title,
    description: row.description,
    suggestedPriority: row.suggested_priority,
    suggestedServiceId: row.suggested_service_id,
    suggestedProblemTypeId: row.suggested_problem_type_id,
    occurrencesCount: toNumber(row.occurrences_count, 1),
    status: row.status,
    acceptedBy: row.accepted_by,
    acceptedAt: row.accepted_at,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    ignoredUntil: row.ignored_until,
    rejectionSilenceUntil: row.rejection_silence_until,
    lastRejectedAt: row.last_rejected_at,
    createdServiceOrderId: row.created_service_order_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromLatestSuggestionValidationRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    scriptId: row.script_id,
    scriptName: row.script_name,
    startedAt: row.started_at,
    validationWindowMinutes: toNumber(row.validation_window_minutes, 30),
    validationDueAt: row.validation_due_at,
    finishedAt: row.finished_at,
    resultSummary: row.result_summary || "",
    logId: row.log_id,
    log: row.log_id ? {
      id: row.log_id,
      status: row.log_status,
      errorDetected: row.log_error_detected === true,
      errorType: row.log_error_type,
      errorCode: row.log_error_code,
      errorCategory: row.log_error_category,
      errorSeverity: row.log_error_severity,
      parsedSummary: row.log_parsed_summary,
      probableCause: row.log_probable_cause,
      suggestedSolution: row.log_suggested_solution,
      requiresAdmin: row.log_requires_admin === true,
      requiresLoggedUser: row.log_requires_logged_user === true,
      attentionRequired: row.log_attention_required === true,
      acknowledgedAt: row.log_acknowledged_at
    } : null
  };
}

function fromAlertCommentRow(row) {
  return {
    id: row.id,
    alertId: row.alert_id,
    userId: row.user_id,
    userName: row.user_name || "Usuário",
    message: row.message,
    createdAt: row.created_at
  };
}

export async function ensureDefaultAlertRules() {
  for (const rule of defaultAlertRules) {
    await query(
      `
        INSERT INTO alert_rules (
          id, type, metric, threshold, duration_minutes, recurrence_count,
          recurrence_window, suggested_priority, creates_suggestion, enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE
        SET suggested_priority = COALESCE(alert_rules.suggested_priority, EXCLUDED.suggested_priority)
      `,
      [
        rule.id,
        rule.type,
        rule.metric,
        rule.threshold,
        rule.durationMinutes,
        rule.recurrenceCount,
        rule.recurrenceWindow,
        normalizePriority(rule.suggestedPriority),
        rule.createsSuggestion,
        rule.enabled
      ]
    );
  }
}

export async function listAlertRules() {
  await ensureDefaultAlertRules();
  const result = await query(`
    SELECT *
    FROM alert_rules
    ORDER BY type ASC
  `);
  return result.rows.map(fromRuleRow);
}

export async function updateAlertRule(id, payload = {}) {
  await ensureDefaultAlertRules();
  const currentResult = await query("SELECT * FROM alert_rules WHERE id = $1", [id]);
  const current = currentResult.rows[0];

  if (!current) {
    const error = new Error("Regra de aviso não encontrada.");
    error.statusCode = 404;
    throw error;
  }

  const threshold = Object.prototype.hasOwnProperty.call(payload, "threshold")
    ? toNumber(payload.threshold, current.threshold)
    : current.threshold;
  const durationMinutes = Object.prototype.hasOwnProperty.call(payload, "durationMinutes")
    ? Math.max(0, Math.round(toNumber(payload.durationMinutes, current.duration_minutes)))
    : current.duration_minutes;
  const recurrenceCount = Object.prototype.hasOwnProperty.call(payload, "recurrenceCount")
    ? Math.max(1, Math.round(toNumber(payload.recurrenceCount, current.recurrence_count)))
    : current.recurrence_count;
  const recurrenceWindow = String(payload.recurrenceWindow || current.recurrence_window || "same_day").trim();
  const suggestedPriority = Object.prototype.hasOwnProperty.call(payload, "suggestedPriority")
    ? normalizePriority(payload.suggestedPriority, current.suggested_priority)
    : normalizePriority(current.suggested_priority);
  const createsSuggestion = normalizeBoolean(payload.createsSuggestion, current.creates_suggestion);
  const enabled = normalizeBoolean(payload.enabled, current.enabled);

  const result = await query(
    `
      UPDATE alert_rules
      SET threshold = $2,
          duration_minutes = $3,
          recurrence_count = $4,
          recurrence_window = $5,
          suggested_priority = $6,
          creates_suggestion = $7,
          enabled = $8,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, threshold, durationMinutes, recurrenceCount, recurrenceWindow, suggestedPriority, createsSuggestion, enabled]
  );

  return fromRuleRow(result.rows[0]);
}

export async function getAlertSettings() {
  const result = await query("SELECT value FROM app_settings WHERE key = 'alert_settings' LIMIT 1");
  const current = result.rows[0]?.value || {};
  const normalized = normalizeAlertSettings(current);

  if (!result.rows.length) {
    await query(
      `
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('alert_settings', $1, NOW())
      `,
      [JSON.stringify(normalized)]
    );
  }

  return normalized;
}

export async function updateAlertSettings(payload = {}) {
  const current = await getAlertSettings();
  const normalized = normalizeAlertSettings({
    rejectedAlertSilenceHours:
      payload.rejectedAlertSilenceHours ?? current.rejectedAlertSilenceHours,
    recurrenceCounterResetHours:
      payload.recurrenceCounterResetHours ?? current.recurrenceCounterResetHours,
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

  await query(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('alert_settings', $1, NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = NOW()
    `,
    [JSON.stringify(normalized)]
  );

  return normalized;
}

export async function updatePendingSuggestionPrioritiesForAlertType(type, suggestedPriority) {
  const priority = normalizePriority(suggestedPriority);

  await query(
    `
      UPDATE service_order_suggestions suggestions
      SET suggested_priority = $2,
          updated_at = NOW()
      FROM alerts
      WHERE alerts.id = suggestions.alert_id
        AND alerts.type = $1
        AND suggestions.status = 'pending'
    `,
    [type, priority]
  );
}

export async function upsertAlert(alert) {
  const result = await query(
    `
      INSERT INTO alerts (
        id, asset_id, host_name, type, metric, title, description, severity,
        value, threshold, status, first_seen_at, last_seen_at, occurrences_count, source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id)
      DO UPDATE SET
        asset_id = EXCLUDED.asset_id,
        host_name = EXCLUDED.host_name,
        type = EXCLUDED.type,
        metric = EXCLUDED.metric,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        severity = EXCLUDED.severity,
        value = EXCLUDED.value,
        threshold = EXCLUDED.threshold,
        status = EXCLUDED.status,
        first_seen_at = EXCLUDED.first_seen_at,
        last_seen_at = EXCLUDED.last_seen_at,
        occurrences_count = EXCLUDED.occurrences_count,
        source = EXCLUDED.source,
        updated_at = NOW()
      RETURNING *
    `,
    [
      alert.id,
      alert.assetId || alert.hostId || null,
      alert.hostName || null,
      alert.type,
      alert.metric,
      alert.title,
      alert.description || "",
      alert.severity || "warning",
      alert.value ?? null,
      alert.threshold ?? null,
      alert.status || "active",
      alert.firstSeenAt || alert.startedAt || new Date().toISOString(),
      alert.lastSeenAt || alert.resolvedAt || alert.startedAt || new Date().toISOString(),
      alert.occurrencesCount || 1,
      alert.source || "mock"
    ]
  );

  return fromAlertRow(result.rows[0]);
}

export async function listAlerts({ status } = {}) {
  const params = [];
  const where = [];

  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }

  const result = await query(
    `
      SELECT *
      FROM alerts
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY last_seen_at DESC, created_at DESC
    `,
    params
  );

  return result.rows.map(fromAlertRow);
}

export async function findAlertById(id) {
  const result = await query("SELECT * FROM alerts WHERE id = $1", [id]);
  return result.rows[0] ? fromAlertRow(result.rows[0]) : null;
}

export async function listAlertComments(alertId) {
  const result = await query(
    `
      SELECT comments.*,
             users.name AS user_name
      FROM alert_comments comments
      LEFT JOIN users ON users.id = comments.user_id
      WHERE comments.alert_id = $1
      ORDER BY comments.created_at ASC
    `,
    [alertId]
  );

  return result.rows.map(fromAlertCommentRow);
}

export async function addAlertComment({ alertId, userId, message }) {
  const cleanMessage = String(message || "").trim();

  if (!cleanMessage) {
    const error = new Error("Informe um comentário para registrar no aviso.");
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `
      INSERT INTO alert_comments (id, alert_id, user_id, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [randomUUID(), alertId, userId || null, cleanMessage.slice(0, 1000)]
  );

  return fromAlertCommentRow(result.rows[0]);
}

export async function listServiceOrderSuggestions() {
  const result = await query(`
    SELECT suggestions.*,
           alerts.host_name,
           alerts.type AS alert_type,
           alerts.metric AS alert_metric,
           alerts.value AS alert_value,
           alerts.threshold AS alert_threshold,
           alerts.source AS alert_source,
           alerts.severity AS alert_severity,
           alerts.first_seen_at AS alert_first_seen_at,
           alerts.last_seen_at AS alert_last_seen_at
    FROM service_order_suggestions suggestions
    LEFT JOIN alerts ON alerts.id = suggestions.alert_id
    ORDER BY suggestions.created_at DESC
  `);

  const suggestionIds = result.rows.map((row) => row.id).filter(Boolean);
  const latestValidationBySuggestion = new Map();

  if (suggestionIds.length) {
    const placeholders = suggestionIds.map((_, index) => `$${index + 1}`).join(", ");
    const validationResult = await query(
      `
        SELECT validations.*,
               scripts.name AS script_name,
               logs.status AS log_status,
               logs.error_detected AS log_error_detected,
               logs.error_type AS log_error_type,
               logs.error_code AS log_error_code,
               logs.error_category AS log_error_category,
               logs.error_severity AS log_error_severity,
               logs.parsed_summary AS log_parsed_summary,
               logs.probable_cause AS log_probable_cause,
               logs.suggested_solution AS log_suggested_solution,
               logs.requires_admin AS log_requires_admin,
               logs.requires_logged_user AS log_requires_logged_user,
               logs.attention_required AS log_attention_required,
               logs.acknowledged_at AS log_acknowledged_at
        FROM script_validation_runs validations
        LEFT JOIN maintenance_scripts scripts ON scripts.id = validations.script_id
        LEFT JOIN script_execution_logs logs ON logs.id = validations.log_id
        WHERE validations.suggestion_id IN (${placeholders})
        ORDER BY validations.suggestion_id ASC, validations.created_at DESC
      `,
      suggestionIds
    );

    for (const row of validationResult.rows) {
      if (!latestValidationBySuggestion.has(row.suggestion_id)) {
        latestValidationBySuggestion.set(row.suggestion_id, fromLatestSuggestionValidationRow(row));
      }
    }
  }

  return result.rows.map((row) => ({
    ...fromSuggestionRow(row),
    hostName: row.host_name,
    alertType: row.alert_type,
    alertMetric: row.alert_metric,
    alertValue: toNumber(row.alert_value),
    alertThreshold: toNumber(row.alert_threshold),
    alertSource: row.alert_source,
    alertSeverity: row.alert_severity,
    alertFirstSeenAt: row.alert_first_seen_at,
    alertLastSeenAt: row.alert_last_seen_at,
    latestValidation: latestValidationBySuggestion.get(row.id) || null
  }));
}

export async function findServiceOrderSuggestionById(id) {
  const result = await query("SELECT * FROM service_order_suggestions WHERE id = $1", [id]);
  return result.rows[0] ? fromSuggestionRow(result.rows[0]) : null;
}

export async function createSuggestionForAlert(alert, suggestion) {
  const existing = await query(
    "SELECT * FROM service_order_suggestions WHERE alert_id = $1 LIMIT 1",
    [alert.id]
  );

  if (existing.rows[0]) {
    const current = existing.rows[0];
    const isRejected = current.status === "rejected";
    const silenceUntil = current.rejection_silence_until || current.ignored_until;
    const isStillSilenced = silenceUntil && new Date(silenceUntil).getTime() > Date.now();

    if (current.status === "accepted") {
      return { suggestion: null, created: false };
    }

    if (isRejected && isStillSilenced) {
      return { suggestion: null, created: false, ignored: true };
    }

    const updateResult = await query(
      `
        UPDATE service_order_suggestions
        SET asset_id = $2,
            title = $3,
            description = $4,
            suggested_priority = $5,
            suggested_service_id = $6,
            suggested_problem_type_id = $7,
            occurrences_count = GREATEST(occurrences_count, $8),
            status = 'pending',
            rejected_by = NULL,
            rejected_at = NULL,
            rejection_reason = NULL,
            ignored_until = NULL,
            rejection_silence_until = NULL,
            updated_at = NOW()
        WHERE alert_id = $1
        RETURNING *
      `,
      [
        alert.id,
        alert.assetId || null,
        suggestion.title,
        suggestion.description,
        suggestion.suggestedPriority,
        suggestion.suggestedServiceId || null,
        suggestion.suggestedProblemTypeId || null,
        suggestion.occurrencesCount || alert.occurrencesCount || 1
      ]
    );

    return {
      suggestion: updateResult.rows[0] ? fromSuggestionRow(updateResult.rows[0]) : null,
      created: false
    };
  }

  const result = await query(
    `
      INSERT INTO service_order_suggestions (
        id, alert_id, asset_id, title, description, suggested_priority,
        suggested_service_id, suggested_problem_type_id, occurrences_count, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      ON CONFLICT (alert_id) DO NOTHING
      RETURNING *
    `,
    [
      randomUUID(),
      alert.id,
      alert.assetId || null,
      suggestion.title,
      suggestion.description,
      suggestion.suggestedPriority,
      suggestion.suggestedServiceId || null,
      suggestion.suggestedProblemTypeId || null,
      suggestion.occurrencesCount || alert.occurrencesCount || 1
    ]
  );

  if (!result.rows[0]) {
    const updateResult = await query(
      `
        UPDATE service_order_suggestions
        SET asset_id = $2,
            title = $3,
            description = $4,
            suggested_priority = $5,
            suggested_service_id = $6,
            suggested_problem_type_id = $7,
            occurrences_count = GREATEST(occurrences_count, $8),
            updated_at = NOW()
        WHERE alert_id = $1
          AND status = 'pending'
        RETURNING *
      `,
      [
        alert.id,
        alert.assetId || null,
        suggestion.title,
        suggestion.description,
        suggestion.suggestedPriority,
        suggestion.suggestedServiceId || null,
        suggestion.suggestedProblemTypeId || null,
        suggestion.occurrencesCount || alert.occurrencesCount || 1
      ]
    );

    return {
      suggestion: updateResult.rows[0] ? fromSuggestionRow(updateResult.rows[0]) : null,
      created: false
    };
  }

  return {
    suggestion: result.rows[0] ? fromSuggestionRow(result.rows[0]) : null,
    created: Boolean(result.rows[0])
  };
}

export async function markSuggestionAccepted({ id, userId, serviceOrderId }) {
  const result = await query(
    `
      UPDATE service_order_suggestions
      SET status = 'accepted',
          accepted_by = $2,
          accepted_at = NOW(),
          created_service_order_id = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, userId || null, serviceOrderId || null]
  );

  return result.rows[0] ? fromSuggestionRow(result.rows[0]) : null;
}

export async function markSuggestionRejected({ id, userId, reason, silenceHours = 24 }) {
  const hours = Math.max(1, toNumber(silenceHours, 24));
  const result = await query(
    `
      UPDATE service_order_suggestions
      SET status = 'rejected',
          rejected_by = $2,
          rejected_at = NOW(),
          last_rejected_at = NOW(),
          rejection_reason = $3,
          ignored_until = NOW() + ($4::int * INTERVAL '1 hour'),
          rejection_silence_until = NOW() + ($4::int * INTERVAL '1 hour'),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, userId || null, reason?.trim() || null, hours]
  );

  return result.rows[0] ? fromSuggestionRow(result.rows[0]) : null;
}

export async function markSuggestionValidated({ id, status = "validated" }) {
  const result = await query(
    `
      UPDATE service_order_suggestions
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, status]
  );

  return result.rows[0] ? fromSuggestionRow(result.rows[0]) : null;
}
