import { randomUUID } from "node:crypto";
import { query } from "../../database.js";
import { normalizePriority, toNumber } from "../../domain/alerts/alertConfiguration.js";
import { fromLatestSuggestionValidationRow, fromSuggestionRow } from "./alertMappers.js";

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
           alerts.last_seen_at AS alert_last_seen_at,
           agent_assets.machine_alias
    FROM service_order_suggestions suggestions
    LEFT JOIN alerts ON alerts.id = suggestions.alert_id
    LEFT JOIN agent_assets ON agent_assets.asset_id = suggestions.asset_id
    WHERE alerts.source <> 'mock'
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
               logs.raw_log AS log_raw_log,
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
               logs.acknowledged_at AS log_acknowledged_at,
               jobs.id AS job_id,
               jobs.status AS job_status,
               jobs.claimed_at AS job_claimed_at,
               jobs.completed_at AS job_completed_at,
               jobs.exit_code AS job_exit_code,
               jobs.timed_out AS job_timed_out,
               jobs.stdout AS job_stdout,
               jobs.stderr AS job_stderr,
               jobs.error_message AS job_error_message
        FROM script_validation_runs validations
        LEFT JOIN maintenance_scripts scripts ON scripts.id = validations.script_id
        LEFT JOIN script_execution_logs logs ON logs.id = validations.log_id
        LEFT JOIN agent_script_jobs jobs ON jobs.execution_log_id = logs.id
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
    machineAlias: row.machine_alias,
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

// Ponteiro reverso: dado o id de uma OS ja criada, encontra a sugestao de
// alerta que a originou (se houver) - usado pra mostrar/linkar "alerta
// relacionado" na ficha da OS, sem precisar de uma coluna alert_id direta
// em service_orders (created_service_order_id ja e unico por alerta).
export async function findServiceOrderSuggestionByServiceOrderId(serviceOrderId) {
  const result = await query(
    "SELECT * FROM service_order_suggestions WHERE created_service_order_id = $1 LIMIT 1",
    [serviceOrderId]
  );
  return result.rows[0] ? fromSuggestionRow(result.rows[0]) : null;
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
  const silenceUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const result = await query(
    `
      UPDATE service_order_suggestions
      SET status = 'rejected',
          rejected_by = $2,
          rejected_at = NOW(),
          last_rejected_at = NOW(),
          rejection_reason = $3,
          ignored_until = $4,
          rejection_silence_until = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, userId || null, reason?.trim() || null, silenceUntil]
  );

  return result.rows[0] ? fromSuggestionRow(result.rows[0]) : null;
}

export async function findSuggestionRowByAlertId(alertId) {
  const result = await query(
    "SELECT * FROM service_order_suggestions WHERE alert_id = $1 LIMIT 1",
    [alertId]
  );
  return result.rows[0] || null;
}

function suggestionValues(alert, suggestion) {
  return [
    alert.id,
    alert.assetId || null,
    suggestion.title,
    suggestion.description,
    suggestion.suggestedPriority,
    suggestion.suggestedServiceId || null,
    suggestion.suggestedProblemTypeId || null,
    suggestion.occurrencesCount || alert.occurrencesCount || 1
  ];
}

/** Reabre uma sugestao existente (pendente, sem rejeicao) com os dados novos do aviso. */
export async function reopenSuggestionForAlert(alert, suggestion) {
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
    suggestionValues(alert, suggestion)
  );

  return updateResult.rows[0] ? fromSuggestionRow(updateResult.rows[0]) : null;
}

/** Insere a sugestao; devolve null quando outra criacao concorrente ja inseriu (alert_id unico). */
export async function insertSuggestionForAlert(alert, suggestion) {
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
    [randomUUID(), ...suggestionValues(alert, suggestion)]
  );

  return result.rows[0] ? fromSuggestionRow(result.rows[0]) : null;
}

/** Atualiza so os dados de uma sugestao ainda pendente (disputa de criacao concorrente). */
export async function refreshPendingSuggestionForAlert(alert, suggestion) {
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
    suggestionValues(alert, suggestion)
  );

  return updateResult.rows[0] ? fromSuggestionRow(updateResult.rows[0]) : null;
}

export async function findSuggestionStatusRow(db, id) {
  const current = await db("SELECT status, alert_id FROM service_order_suggestions WHERE id = $1", [id]);
  return current.rows[0] || null;
}

export async function updateSuggestionObservation(db, { id, status, observationStatus, resultSummary, validationId }) {
  const result = await db(
    `
      UPDATE service_order_suggestions
      SET status = $2,
          observation_status = $3,
          observation_result = $4,
          last_validation_id = COALESCE($5, last_validation_id),
          last_observation_at = NOW(),
           updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, status, observationStatus, resultSummary || null, validationId || null]
  );

  return result.rows[0] ? fromSuggestionRow(result.rows[0]) : null;
}
