import { query } from "../database.js";
import { fromAgendaRow, fromAssetHistoryRow, fromAuditLogRow, fromScriptSummaryRow } from "./preventiveAutomationMappers.js";

/**
 * Consultas de leitura das visoes de gerenciamento, agenda, historico e
 * detalhe por maquina. Todo valor trafega como parametro posicional.
 */

/** Resumo (id, nome, categoria, risco) dos scripts informados, por id. */
export async function listScriptSummariesByIds(scriptIds, db = query) {
  if (!scriptIds.length) return new Map();
  const placeholders = scriptIds.map((_, index) => `$${index + 1}`).join(", ");
  const result = await db(`SELECT id, name, category, risk_level FROM maintenance_scripts WHERE id IN (${placeholders})`, scriptIds);
  return new Map(result.rows.map((row) => [String(row.id), fromScriptSummaryRow(row)]));
}

/**
 * Monta a clausula WHERE da agenda. Somente fragmentos fixos entram no SQL;
 * todos os valores seguem em `values` como $n.
 */
function buildAgendaConditions(filters, allowedPlanIds) {
  const conditions = ["plans.deleted_at IS NULL"];
  const values = [];
  const pushCondition = (sql, value) => {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  };

  const planPlaceholders = allowedPlanIds.map((_, index) => `$${values.length + index + 1}`).join(", ");
  conditions.push(`plans.id IN (${planPlaceholders})`);
  values.push(...allowedPlanIds);

  if (filters.startDate) pushCondition("schedules.next_run_at >= ?", filters.startDate);
  if (filters.endDate) pushCondition("schedules.next_run_at <= ?", filters.endDate);
  if (filters.planId) pushCondition("plans.id = ?", filters.planId);
  if (filters.assetId) pushCondition("schedules.asset_id = ?", filters.assetId);
  if (filters.status === "active") conditions.push("plans.active = TRUE AND schedules.active = TRUE");
  if (filters.status === "overdue") {
    conditions.push("plans.active = TRUE AND schedules.active = TRUE AND schedules.next_run_at < NOW()");
  }
  if (filters.status === "without_schedule") conditions.push("schedules.next_run_at IS NULL");

  return { where: conditions.join(" AND "), values };
}

/** Pagina da agenda (ja restrita aos planos permitidos) e o total sem paginacao. */
export async function listAgendaPage({ filters, allowedPlanIds }, db = query) {
  const { where, values } = buildAgendaConditions(filters, allowedPlanIds);
  const baseFrom = `
      FROM preventive_automation_asset_schedules schedules
      INNER JOIN preventive_automation_plans plans ON plans.id = schedules.plan_id
      WHERE ${where}
  `;
  const pageValues = [...values, filters.limit, filters.offset];
  const limitPlaceholder = `$${pageValues.length - 1}`;
  const offsetPlaceholder = `$${pageValues.length}`;

  const [result, countResult] = await Promise.all([
    db(
      `
      SELECT schedules.*,
             plans.name AS plan_name,
             plans.indicator_color,
             plans.active AS plan_active
      ${baseFrom}
      ORDER BY schedules.next_run_at ASC NULLS LAST, plans.name ASC, schedules.asset_id ASC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
      `,
      pageValues
    ),
    db(`SELECT COUNT(*)::int AS total_count ${baseFrom}`, values)
  ]);

  return {
    rows: result.rows.map(fromAgendaRow),
    total: Number(countResult.rows[0]?.total_count || 0)
  };
}

/** Eventos de auditoria que citam o plano, mais recentes primeiro. */
export async function listPlanAuditLogs(planId, limit, db = query) {
  const result = await db(
    `
      SELECT logs.id,
             logs.type,
             logs.message,
             logs.meta,
             logs.created_at,
             users.name AS user_name
      FROM audit_logs logs
      LEFT JOIN users ON users.id = logs.user_id
      WHERE logs.meta->>'preventiveAutomationPlanId' = $1
         OR logs.meta->>'planId' = $1
      ORDER BY logs.created_at DESC
      LIMIT $2
    `,
    [planId, limit]
  );
  return result.rows.map(fromAuditLogRow);
}

/** Ultimos eventos de automacao preventiva registrados no historico da maquina. */
export async function listAutomationHistoryForAsset(assetId, limit = 10, db = query) {
  const result = await db(
    `
      SELECT id, event_type, message, old_value, new_value, user_name, created_at
      FROM asset_history
      WHERE asset_id = $1
        AND event_type LIKE 'preventive_automation%'
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [assetId, limit]
  );
  return result.rows.map(fromAssetHistoryRow);
}
