import { randomUUID } from "node:crypto";
import { query } from "../database.js";

const STDOUT_STDERR_EXCERPT_LENGTH = 500;

function fromScriptJobRow(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    scriptId: row.script_id,
    scriptName: row.script_name,
    riskLevel: row.risk_level,
    status: row.status,
    timeoutSeconds: Number(row.timeout_seconds || 0),
    requestedBy: row.requested_by,
    requestedByName: row.requested_by_name,
    claimedAt: row.claimed_at,
    completedAt: row.completed_at,
    exitCode: row.exit_code,
    timedOut: Boolean(row.timed_out),
    stdoutExcerpt: row.stdout_excerpt || "",
    stderrExcerpt: row.stderr_excerpt || "",
    errorMessage: row.error_message,
    createdAt: row.created_at,
    serviceOrderId: row.service_order_id,
    alertId: row.alert_id,
    suggestionId: row.suggestion_id
  };
}

/**
 * `stdout`/`stderr` sao truncados aqui, na propria consulta SQL
 * (`SUBSTRING` - `LEFT` nao existe no pg-mem usado pelos testes), nunca
 * buscados inteiros (ate 64KB cada) para so depois cortar em JS - e
 * `script_content` (o corpo completo do script) nunca aparece no SELECT.
 */
export async function listReportScriptJobs({ startDate, endDate } = {}) {
  const params = [];
  const where = [];

  if (startDate) {
    params.push(`${startDate}T00:00:00.000Z`);
    where.push(`j.created_at >= $${params.length}`);
  }
  if (endDate) {
    params.push(`${endDate}T23:59:59.999Z`);
    where.push(`j.created_at <= $${params.length}`);
  }

  const excerptLength = STDOUT_STDERR_EXCERPT_LENGTH;

  const result = await query(
    `
      SELECT
        j.id,
        j.asset_id,
        j.script_id,
        j.status,
        j.timeout_seconds,
        j.requested_by,
        u.name AS requested_by_name,
        j.claimed_at,
        j.completed_at,
        j.exit_code,
        j.timed_out,
        SUBSTRING(j.stdout, 1, ${excerptLength}) AS stdout_excerpt,
        SUBSTRING(j.stderr, 1, ${excerptLength}) AS stderr_excerpt,
        j.error_message,
        j.created_at,
        s.name AS script_name,
        s.risk_level,
        sel.service_order_id,
        sel.alert_id,
        sel.suggestion_id
      FROM agent_script_jobs j
      JOIN maintenance_scripts s ON s.id = j.script_id
      LEFT JOIN users u ON u.id = j.requested_by
      LEFT JOIN script_execution_logs sel ON sel.id = j.execution_log_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY j.created_at DESC
    `,
    params
  );

  return result.rows.map(fromScriptJobRow);
}

function fromRemoteAssistanceSessionRow(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    serviceOrderId: row.service_order_id,
    technicianName: row.technician_name,
    status: row.status,
    connectionMode: row.connection_mode,
    consentStatus: row.consent_status,
    requestedAt: row.requested_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    endReason: row.end_reason
  };
}

/**
 * SELECT com colunas nomeadas, nunca `SELECT *` - nunca inclui
 * viewer_token_hash/agent_token_hash e nunca consulta
 * remote_assistance_events (frames/chat).
 */
export async function listReportRemoteAssistanceSessions({ startDate, endDate } = {}) {
  const params = [];
  const where = [];

  if (startDate) {
    params.push(`${startDate}T00:00:00.000Z`);
    where.push(`requested_at >= $${params.length}`);
  }
  if (endDate) {
    params.push(`${endDate}T23:59:59.999Z`);
    where.push(`requested_at <= $${params.length}`);
  }

  const result = await query(
    `
      SELECT
        id, asset_id, service_order_id, technician_name, status,
        connection_mode, consent_status, requested_at, started_at, ended_at, end_reason
      FROM remote_assistance_sessions
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY requested_at DESC
    `,
    params
  );

  return result.rows.map(fromRemoteAssistanceSessionRow);
}

/**
 * So o conjunto de alert_id que ja tiveram algum script executado/registrado
 * (script_execution_logs cobre tanto execucao real via agente quanto
 * registro manual/simulado - agent_script_jobs so cobre a execucao real).
 */
export async function listAlertIdsWithScriptExecution() {
  const result = await query(
    "SELECT DISTINCT alert_id FROM script_execution_logs WHERE alert_id IS NOT NULL"
  );
  return result.rows.map((row) => row.alert_id);
}

/**
 * Projecao minima (so id/numero) para o relatorio de Alertas conseguir
 * mostrar o numero da OS gerada por uma sugestao aceita, sem precisar
 * buscar a lista completa de OS (que aplicaria escopo de visibilidade por
 * usuario, irrelevante para esse dado pontual e de baixa sensibilidade).
 */
export async function findServiceOrderNumbersByIds(ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return new Map();

  const placeholders = uniqueIds.map((_, index) => `$${index + 1}`).join(", ");
  const result = await query(
    `SELECT id, number FROM service_orders WHERE id IN (${placeholders})`,
    uniqueIds
  );
  return new Map(result.rows.map((row) => [row.id, row.number]));
}

export async function recordReportExport({
  reportType,
  format = "csv",
  filters = {},
  requestedBy = null,
  rowCount = 0
}, db = query) {
  await db(
    `
      INSERT INTO report_exports (id, report_type, format, filters, requested_by, row_count, generated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
    [randomUUID(), reportType, format, JSON.stringify(filters || {}), requestedBy, rowCount]
  );
}
