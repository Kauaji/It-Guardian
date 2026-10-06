import { query } from "../../database.js";
import { fromValidationRow } from "./scriptMappers.js";

/**
 * SQL das observacoes de scripts ligados a sugestoes de OS
 * (script_validation_runs). A observacao "ativa" e unica por sugestao+script
 * (indice unico em active_key); quem decide reuso e conclusao e o servico.
 */

export async function listScriptValidationsForSuggestion(suggestionId) {
  const result = await query(
    `
      SELECT validations.*,
             scripts.name AS script_name
      FROM script_validation_runs validations
      LEFT JOIN maintenance_scripts scripts ON scripts.id = validations.script_id
      WHERE validations.suggestion_id = $1
      ORDER BY validations.created_at DESC
    `,
    [suggestionId]
  );

  return result.rows.map(fromValidationRow);
}

export async function findActiveScriptValidationForSuggestion(suggestionId, scriptId, db = query) {
  const result = await db(
    `
      SELECT validations.*,
             scripts.name AS script_name
      FROM script_validation_runs validations
      LEFT JOIN maintenance_scripts scripts ON scripts.id = validations.script_id
      WHERE validations.suggestion_id = $1
        AND validations.script_id = $2
        AND validations.active_key IS NOT NULL
        AND validations.status IN ('waiting_agent', 'prepared', 'observation_pending', 'pending_validation')
      ORDER BY validations.created_at DESC
      LIMIT 1
    `,
    [suggestionId, scriptId]
  );

  return result.rows[0] ? fromValidationRow(result.rows[0]) : null;
}

/**
 * Cria a observacao ativa em 'waiting_agent'. Devolve a linha criada ou null
 * se outra chamada concorrente ja criou a observacao ativa (ON CONFLICT).
 */
export async function insertActiveValidationRun(
  db,
  {
    id,
    suggestionId,
    alertId,
    assetId,
    scriptId,
    startedBy,
    validationWindowMinutes,
    validationDueAt,
    resultSummary,
    activeKey,
    observationSlot
  }
) {
  const validationInsert = await db(
    `
      INSERT INTO script_validation_runs (
        id, suggestion_id, alert_id, asset_id, script_id, status, started_by,
        validation_window_minutes, validation_due_at, result_summary,
        idempotency_key, observation_slot, active_key
      )
      VALUES ($1, $2, $3, $4, $5, 'waiting_agent', $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (active_key) DO NOTHING
      RETURNING *
    `,
    [
      id,
      suggestionId,
      alertId,
      assetId,
      scriptId,
      startedBy,
      validationWindowMinutes,
      validationDueAt,
      resultSummary,
      activeKey,
      observationSlot,
      activeKey
    ]
  );

  return validationInsert.rows[0] || null;
}

export async function attachLogToValidationRun(db, { validationId, logId, scriptName }) {
  const validationResult = await db(
    `
      UPDATE script_validation_runs
      SET log_id = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [validationId, logId]
  );

  return fromValidationRow({ ...validationResult.rows[0], script_name: scriptName });
}

/** Observacoes ainda abertas cujo prazo ja venceu, com o estado atual do aviso. */
export async function listDueScriptValidations() {
  const result = await query(`
    SELECT validations.*,
           scripts.name AS script_name,
           alerts.status AS alert_status,
           alerts.title AS alert_title
    FROM script_validation_runs validations
    LEFT JOIN maintenance_scripts scripts ON scripts.id = validations.script_id
    LEFT JOIN alerts ON alerts.id = validations.alert_id
    WHERE validations.status IN ('waiting_agent', 'prepared', 'observation_pending', 'pending_validation')
      AND validations.validation_due_at <= NOW()
    ORDER BY validations.validation_due_at ASC
  `);

  return result.rows;
}

/** Encerra uma observacao vencida; devolve null se ela ja foi concluida por outra via. */
export async function finishDueValidationRun(db, { id, status, resultSummary, scriptName }) {
  const updated = await db(
    `
      UPDATE script_validation_runs
      SET status = $2,
          finished_at = NOW(),
          result_summary = $3,
          active_key = NULL,
          updated_at = NOW()
      WHERE id = $1
        AND status IN ('waiting_agent', 'prepared', 'observation_pending', 'pending_validation')
      RETURNING *
    `,
    [id, status, resultSummary]
  );

  return updated.rows[0] ? fromValidationRow({ ...updated.rows[0], script_name: scriptName }) : null;
}

/** Cancela uma observacao aberta; devolve null se nao existe ou ja foi finalizada. */
export async function cancelValidationRun(db, id) {
  const result = await db(
    `
      UPDATE script_validation_runs
      SET status = 'validation_cancelled',
          finished_at = NOW(),
          active_key = NULL,
          result_summary = 'Observação cancelada manualmente.',
          updated_at = NOW()
      WHERE id = $1
        AND status IN ('waiting_agent', 'prepared', 'observation_pending', 'pending_validation')
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] ? fromValidationRow(result.rows[0]) : null;
}
