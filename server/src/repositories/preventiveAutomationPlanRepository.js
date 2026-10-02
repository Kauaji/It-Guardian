import { query } from "../database.js";
import { fromPlanRow } from "./preventiveAutomationMappers.js";

/** SQL da tabela preventive_automation_plans (somente persistencia e mapeamento). */

const planSelect = `
  SELECT automation.*,
         plans.name AS preventive_plan_name,
         users.name AS created_by_name
  FROM preventive_automation_plans automation
  LEFT JOIN preventive_plans plans ON plans.id = automation.preventive_plan_id
  LEFT JOIN users ON users.id = automation.created_by
`;

const insertColumns = `
  id, preventive_plan_id, name, description, active, recurrence_type, recurrence_interval,
  preferred_time, timezone, scope_type, scope_id, default_script_ids,
  asset_ids, excluded_asset_ids, notes, indicator_color, last_scheduled_at, next_run_at,
  schedule_anchor_at, created_by
`;

/** Planos nao excluidos, mais recentes primeiro. */
export async function listActivePlans(db = query) {
  const result = await db(`
    ${planSelect}
    WHERE automation.deleted_at IS NULL
    ORDER BY automation.created_at DESC
  `);
  return result.rows.map(fromPlanRow);
}

export async function findActivePlanById(id, db = query) {
  const result = await db(
    `
      ${planSelect}
      WHERE automation.id = $1
        AND automation.deleted_at IS NULL
    `,
    [id]
  );
  return fromPlanRow(result.rows[0]);
}

export async function findActivePlanByPreventivePlanId(preventivePlanId, db = query) {
  const result = await db(
    `
      ${planSelect}
      WHERE automation.preventive_plan_id = $1
        AND automation.deleted_at IS NULL
      ORDER BY automation.created_at DESC
      LIMIT 1
    `,
    [preventivePlanId]
  );
  return fromPlanRow(result.rows[0]);
}

/** Todos os planos (inclusive excluidos), do mais antigo ao mais novo. */
export async function listAllPlans(db = query) {
  const result = await db(`
    SELECT *
    FROM preventive_automation_plans
    ORDER BY created_at ASC
  `);
  return result.rows.map(fromPlanRow);
}

/** Planos ativos com ao menos uma agenda ativa vencida em `nowIso`. */
export async function listDuePlans(nowIso, db = query) {
  const result = await db(
    `
      SELECT DISTINCT plans.*
      FROM preventive_automation_asset_schedules schedules
      INNER JOIN preventive_automation_plans plans ON plans.id = schedules.plan_id
      WHERE plans.active = TRUE
        AND schedules.active = TRUE
        AND schedules.next_run_at <= $1
      ORDER BY plans.next_run_at ASC NULLS LAST, plans.created_at ASC
    `,
    [nowIso]
  );
  return result.rows.map(fromPlanRow);
}

/** Preenche somente os campos de agenda ainda nulos (planos legados). */
export async function fillMissingPlanSchedule(id, { scheduleAnchorAt, nextRunAt, lastScheduledAt }, db = query) {
  await db(
    `
      UPDATE preventive_automation_plans
      SET schedule_anchor_at = COALESCE(schedule_anchor_at, $2),
          next_run_at = COALESCE(next_run_at, $3),
          last_scheduled_at = COALESCE(last_scheduled_at, $4)
      WHERE id = $1
    `,
    [id, scheduleAnchorAt, nextRunAt, lastScheduledAt]
  );
}

/**
 * Plano com nome ou cor de indicador em uso por outro plano nao excluido.
 * `excludeId` ignora o proprio plano durante a edicao.
 */
export async function findPlanIdentityConflict({ name, indicatorColor }, excludeId = null, db = query) {
  const values = [name, indicatorColor];
  const excludeCurrent = excludeId ? "AND id <> $3" : "";
  if (excludeId) values.push(excludeId);

  const result = await db(
    `
      SELECT id, name, indicator_color
      FROM preventive_automation_plans
      WHERE deleted_at IS NULL
        AND (LOWER(name) = LOWER($1) OR LOWER(indicator_color) = LOWER($2))
        ${excludeCurrent}
      LIMIT 1
    `,
    values
  );
  return result.rows[0] || null;
}

export async function insertPlan(db, { id, preventivePlanId = null, plan, nextRunAt, scheduleAnchorAt, createdBy }) {
  await db(
    `
      INSERT INTO preventive_automation_plans (${insertColumns})
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    `,
    [
      id,
      preventivePlanId,
      plan.name,
      plan.description,
      plan.active,
      plan.recurrenceType,
      plan.recurrenceInterval,
      plan.preferredTime,
      plan.timezone,
      plan.scopeType,
      plan.scopeId,
      JSON.stringify(plan.defaultScriptIds),
      JSON.stringify(plan.assetIds),
      JSON.stringify(plan.excludedAssetIds),
      plan.notes,
      plan.indicatorColor,
      nextRunAt,
      nextRunAt,
      scheduleAnchorAt,
      createdBy
    ]
  );
}

export async function updatePlan(db, { id, plan, nextRunAt, scheduleAnchorAt }) {
  await db(
    `
      UPDATE preventive_automation_plans
      SET name = $2,
          description = $3,
          active = $4,
          recurrence_type = $5,
          recurrence_interval = $6,
          preferred_time = $7,
          timezone = $8,
          scope_type = $9,
          scope_id = $10,
          default_script_ids = $11,
          asset_ids = $12,
          excluded_asset_ids = $13,
          notes = $14,
          indicator_color = $15,
          last_scheduled_at = COALESCE(last_scheduled_at, $16),
          next_run_at = COALESCE(next_run_at, $17),
          schedule_anchor_at = COALESCE(schedule_anchor_at, $18),
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      id,
      plan.name,
      plan.description,
      plan.active,
      plan.recurrenceType,
      plan.recurrenceInterval,
      plan.preferredTime,
      plan.timezone,
      plan.scopeType,
      plan.scopeId,
      JSON.stringify(plan.defaultScriptIds),
      JSON.stringify(plan.assetIds),
      JSON.stringify(plan.excludedAssetIds),
      plan.notes,
      plan.indicatorColor,
      nextRunAt,
      nextRunAt,
      scheduleAnchorAt
    ]
  );
}

export async function deactivatePlan(db, id) {
  await db(
    `
      UPDATE preventive_automation_plans
      SET active = FALSE,
          updated_at = NOW()
      WHERE id = $1
    `,
    [id]
  );
}

export async function reactivatePlanRow(db, id) {
  await db(
    `
      UPDATE preventive_automation_plans
      SET active = TRUE,
          updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
    `,
    [id]
  );
}

export async function softDeletePlan(db, id) {
  await db(
    `
      UPDATE preventive_automation_plans
      SET active = FALSE,
          deleted_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
    `,
    [id]
  );
}

/** Atualiza a lista de maquinas e desativa o plano quando nao restar nenhuma. */
export async function updatePlanAssetScope(db, { id, assetIds, excludedAssetIds, remainingAssetCount }) {
  await db(
    `
      UPDATE preventive_automation_plans
      SET asset_ids = $2,
          excluded_asset_ids = $3,
          active = CASE WHEN $4::int = 0 THEN FALSE ELSE active END,
          updated_at = NOW()
      WHERE id = $1
    `,
    [id, JSON.stringify(assetIds), JSON.stringify(excludedAssetIds), remainingAssetCount]
  );
}

export async function updatePlanNextRun(db, planId, nextRunAt) {
  await db(
    `
      UPDATE preventive_automation_plans
      SET next_run_at = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [planId, nextRunAt]
  );
}

/**
 * Registra o preparo do plano. `lastScheduledAt` so e informado no preparo
 * agendado; em preparos manuais fica nulo e o valor atual e preservado.
 */
export async function markPlanPrepared(db, { id, preparedAt, lastScheduledAt, nextRunAt }) {
  await db(
    `
      UPDATE preventive_automation_plans
      SET last_prepared_at = $2,
          last_scheduled_at = COALESCE($3, last_scheduled_at),
          next_run_at = COALESCE($4, next_run_at),
          updated_at = NOW()
      WHERE id = $1
    `,
    [id, preparedAt, lastScheduledAt, nextRunAt]
  );
}
