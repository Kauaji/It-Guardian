import { randomUUID } from "node:crypto";
import { query } from "../database.js";

/**
 * SQL das tabelas preventive_plans, preventive_plan_scripts e
 * preventive_plan_assets, com o mapeamento linha -> objeto.
 */

function fromPlanRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    status: row.status,
    source: row.source,
    originAlertId: row.origin_alert_id,
    originSuggestionId: row.origin_suggestion_id,
    serviceOrderId: row.service_order_id,
    serviceOrder: row.linked_service_order_id
      ? {
          id: row.linked_service_order_id,
          number: row.linked_service_order_number,
          title: row.linked_service_order_title,
          status: row.linked_service_order_status
        }
      : null,
    notes: row.notes || "",
    createdBy: row.created_by,
    preparedAt: row.prepared_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    automation: { enabled: false }
  };
}

function fromPlanAssetRow(row) {
  return {
    id: row.id,
    preventivePlanId: row.preventive_plan_id,
    assetId: row.asset_id,
    status: row.status,
    log: row.log || "",
    preparedAt: row.prepared_at,
    completedAt: row.completed_at
  };
}

function fromPlanScriptRow(row) {
  return {
    id: row.id,
    preventivePlanId: row.preventive_plan_id,
    scriptId: row.script_id,
    orderIndex: row.order_index,
    scriptName: row.script_name || "",
    scriptType: row.script_type || "",
    riskLevel: row.risk_level || "medium",
    category: row.category || "",
    estimatedSummary: row.estimated_summary || ""
  };
}

const planWithServiceOrderSelect = `
  SELECT plans.*,
         orders.id AS linked_service_order_id,
         orders.number AS linked_service_order_number,
         orders.title AS linked_service_order_title,
         orders.status AS linked_service_order_status
  FROM preventive_plans plans
  LEFT JOIN service_orders orders ON orders.id = plans.service_order_id
`;

export async function listPlans(db = query) {
  const result = await db(`
    ${planWithServiceOrderSelect}
    ORDER BY plans.created_at DESC
  `);
  return result.rows.map(fromPlanRow);
}

export async function findPlanById(id, db = query) {
  const result = await db(
    `
      ${planWithServiceOrderSelect}
      WHERE plans.id = $1
    `,
    [id]
  );
  return result.rows[0] ? fromPlanRow(result.rows[0]) : null;
}

/**
 * Le o plano travando a linha (`FOR UPDATE`) para serializar a criacao da OS.
 * Bancos sem suporte a `FOR UPDATE` (pg-mem) recebem a leitura simples.
 */
export async function lockPlanById(id, db) {
  try {
    const result = await db("SELECT * FROM preventive_plans WHERE id = $1 FOR UPDATE", [id]);
    return result.rows[0] ? fromPlanRow(result.rows[0]) : null;
  } catch (error) {
    if (!/FOR UPDATE|syntax|parse/i.test(error.message || "")) throw error;
    const result = await db("SELECT * FROM preventive_plans WHERE id = $1", [id]);
    return result.rows[0] ? fromPlanRow(result.rows[0]) : null;
  }
}

/** Anexa scripts (com dados do cadastro) e maquinas ao plano. */
export async function hydratePlan(plan, db = query) {
  if (!plan) return null;

  const [scriptResult, assetResult] = await Promise.all([
    db(
      `
        SELECT plan_scripts.*,
               scripts.name AS script_name,
               scripts.type AS script_type,
               scripts.risk_level,
               scripts.category,
               scripts.estimated_summary
        FROM preventive_plan_scripts plan_scripts
        LEFT JOIN maintenance_scripts scripts ON scripts.id = plan_scripts.script_id
        WHERE plan_scripts.preventive_plan_id = $1
        ORDER BY plan_scripts.order_index ASC
      `,
      [plan.id]
    ),
    db(
      `
        SELECT *
        FROM preventive_plan_assets
        WHERE preventive_plan_id = $1
        ORDER BY prepared_at ASC NULLS LAST, asset_id ASC
      `,
      [plan.id]
    )
  ]);

  return {
    ...plan,
    scripts: scriptResult.rows.map(fromPlanScriptRow),
    assets: assetResult.rows.map(fromPlanAssetRow)
  };
}

export async function insertPlan(db, { id, plan, createdBy }) {
  const result = await db(
    `
      INSERT INTO preventive_plans (
        id, name, description, status, source, origin_alert_id,
        origin_suggestion_id, notes, created_by, prepared_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `,
    [
      id,
      plan.name,
      plan.description || null,
      plan.status,
      plan.source,
      plan.originAlertId,
      plan.originSuggestionId,
      plan.notes || null,
      createdBy
    ]
  );
  return result.rows[0].id;
}

export async function insertPlanScript(db, { planId, scriptId, orderIndex }) {
  await db(
    `
      INSERT INTO preventive_plan_scripts (id, preventive_plan_id, script_id, order_index)
      VALUES ($1, $2, $3, $4)
    `,
    [randomUUID(), planId, scriptId, orderIndex]
  );
}

export async function insertPlanAsset(db, { planId, assetId, status, log }) {
  await db(
    `
      INSERT INTO preventive_plan_assets (
        id, preventive_plan_id, asset_id, status, log, prepared_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
    `,
    [randomUUID(), planId, assetId, status, log]
  );
}

export async function markPlanSimulated(db, id) {
  await db(
    `
      UPDATE preventive_plans
      SET status = 'simulated',
          prepared_at = COALESCE(prepared_at, NOW()),
          updated_at = NOW()
      WHERE id = $1
    `,
    [id]
  );
}

export async function markPlanAssetsPrepared(db, planId) {
  await db(
    `
      UPDATE preventive_plan_assets
      SET status = 'prepared',
          prepared_at = COALESCE(prepared_at, NOW())
      WHERE preventive_plan_id = $1
    `,
    [planId]
  );
}

/** Vincula a OS ao plano somente se ainda nao houver vinculo; devolve se atualizou. */
export async function linkServiceOrder(db, { planId, serviceOrderId }) {
  const result = await db(
    `
      UPDATE preventive_plans
      SET service_order_id = $2,
          updated_at = NOW()
      WHERE id = $1
        AND service_order_id IS NULL
      RETURNING id
    `,
    [planId, serviceOrderId]
  );
  return Boolean(result.rowCount);
}
