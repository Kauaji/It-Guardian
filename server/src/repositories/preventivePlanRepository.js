import { randomUUID } from "node:crypto";
import { query } from "../database.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import { addLog } from "./logRepository.js";
import { findMaintenanceScriptById } from "./maintenanceScriptRepository.js";
import { addServiceOrderHistory, createServiceOrder } from "./serviceOrderRepository.js";

const allowedStatuses = new Set(["prepared", "simulated", "completed", "failed", "cancelled"]);
const highRiskLevels = new Set(["high", "critical"]);

function trimString(value, maxLength = 1000, fallback = "") {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : fallback;
}

function normalizeStatus(value, fallback = "prepared") {
  const status = String(value || "").trim().toLowerCase();
  return allowedStatuses.has(status) ? status : fallback;
}

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
    notes: row.notes || "",
    createdBy: row.created_by,
    preparedAt: row.prepared_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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

function normalizePlanPayload(payload = {}) {
  const name = trimString(payload.name, 120);
  const assetIds = Array.isArray(payload.assetIds)
    ? [...new Set(payload.assetIds.map((id) => trimString(id, 120)).filter(Boolean))]
    : [];
  const scriptIds = Array.isArray(payload.scriptIds)
    ? [...new Set(payload.scriptIds.map((id) => trimString(id, 120)).filter(Boolean))]
    : [];

  if (name.length < 3) {
    const error = new Error("Informe um nome de plano preventivo com pelo menos 3 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  if (!assetIds.length) {
    const error = new Error("Selecione pelo menos uma máquina para a preventiva.");
    error.statusCode = 400;
    throw error;
  }

  if (!scriptIds.length) {
    const error = new Error("Selecione pelo menos uma verificação/script cadastrado para compor o plano.");
    error.statusCode = 400;
    throw error;
  }

  return {
    name,
    description: trimString(payload.description, 500),
    source: trimString(payload.source, 80, "manual"),
    originAlertId: trimString(payload.originAlertId, 120) || null,
    originSuggestionId: trimString(payload.originSuggestionId, 120) || null,
    notes: trimString(payload.notes, 1000),
    status: normalizeStatus(payload.status, "prepared"),
    riskAcknowledged: payload.riskAcknowledged === true,
    assetIds,
    scriptIds
  };
}

async function hydratePlan(plan) {
  if (!plan) return null;

  const [scriptResult, assetResult] = await Promise.all([
    query(
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
    query(
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

export async function listPreventivePlans() {
  const result = await query(`
    SELECT *
    FROM preventive_plans
    ORDER BY created_at DESC
  `);

  const plans = result.rows.map(fromPlanRow);
  return Promise.all(plans.map(hydratePlan));
}

export async function findPreventivePlanById(id) {
  const result = await query("SELECT * FROM preventive_plans WHERE id = $1", [id]);
  return hydratePlan(result.rows[0] ? fromPlanRow(result.rows[0]) : null);
}

export async function createPreventivePlan(payload = {}, user = null) {
  const normalized = normalizePlanPayload(payload);
  const scripts = [];

  for (const scriptId of normalized.scriptIds) {
    const script = await findMaintenanceScriptById(scriptId);
    if (!script || script.active === false) {
      const error = new Error("Um dos scripts selecionados não existe ou está inativo.");
      error.statusCode = 400;
      throw error;
    }
    scripts.push(script);
  }

  const hasHighRiskScript = scripts.some((script) => highRiskLevels.has(script.riskLevel || script.suggestedRiskLevel));
  if (hasHighRiskScript && !normalized.riskAcknowledged) {
    const error = new Error("Scripts de alto risco exigem confirmação extra antes de preparar a preventiva.");
    error.statusCode = 400;
    throw error;
  }

  const planId = randomUUID();
  const planResult = await query(
    `
      INSERT INTO preventive_plans (
        id, name, description, status, source, origin_alert_id,
        origin_suggestion_id, notes, created_by, prepared_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `,
    [
      planId,
      normalized.name,
      normalized.description || null,
      normalized.status,
      normalized.source,
      normalized.originAlertId,
      normalized.originSuggestionId,
      normalized.notes || null,
      user?.id || null
    ]
  );

  await Promise.all(scripts.map((script, index) =>
    query(
      `
        INSERT INTO preventive_plan_scripts (id, preventive_plan_id, script_id, order_index)
        VALUES ($1, $2, $3, $4)
      `,
      [randomUUID(), planId, script.id, index]
    )
  ));

  const scriptNames = scripts.map((script) => script.name).join(", ");
  const userName = user?.name || "Usuário";

  await Promise.all(normalized.assetIds.map(async (assetId) => {
    const log =
      `Preventiva registrada para ${assetId} com as verificações: ${scriptNames}. ` +
      "Nenhum comando foi executado nesta versão.";

    await query(
      `
        INSERT INTO preventive_plan_assets (
          id, preventive_plan_id, asset_id, status, log, prepared_at
        )
        VALUES ($1, $2, $3, 'prepared', $4, NOW())
      `,
      [randomUUID(), planId, assetId, log]
    );

    await addAssetHistory({
      assetId,
      eventType: "preventive_plan_prepared",
      message: `Plano preventivo '${normalized.name}' registrado por ${userName}. Nenhum comando foi executado.`,
      newValue: log,
      userId: user?.id || null,
      userName
    });
  }));

  await addLog({
    type: "preventive_plan_created",
    message: `Plano preventivo registrado: ${normalized.name}. Nenhum comando foi executado.`,
    userId: user?.id || null,
    meta: {
      preventivePlanId: planId,
      assetCount: normalized.assetIds.length,
      scriptCount: scripts.length,
      source: normalized.source
    }
  });

  return findPreventivePlanById(planResult.rows[0].id);
}

export async function preparePreventivePlan(id, user = null) {
  const plan = await findPreventivePlanById(id);
  if (!plan) return null;

  await query(
    `
      UPDATE preventive_plans
      SET status = 'simulated',
          prepared_at = COALESCE(prepared_at, NOW()),
          updated_at = NOW()
      WHERE id = $1
    `,
    [id]
  );

  await query(
    `
      UPDATE preventive_plan_assets
      SET status = 'prepared',
          prepared_at = COALESCE(prepared_at, NOW())
      WHERE preventive_plan_id = $1
    `,
    [id]
  );

  await addLog({
    type: "preventive_plan_prepared",
    message: `Registro preventivo confirmado: ${plan.name}. Nenhum comando foi executado.`,
    userId: user?.id || null,
    meta: { preventivePlanId: id }
  });

  return findPreventivePlanById(id);
}

export async function createServiceOrderFromPreventivePlan(id, user = null) {
  const plan = await findPreventivePlanById(id);
  if (!plan) return null;

  if (plan.serviceOrderId) {
    const error = new Error("Este plano já possui uma OS preventiva vinculada.");
    error.statusCode = 409;
    throw error;
  }

  const assetIds = (plan.assets || []).map((asset) => asset.assetId).filter(Boolean);
  const scriptNames = (plan.scripts || []).map((script) => script.scriptName || script.name).filter(Boolean);
  const assetSummary = assetIds.length ? assetIds.join(", ") : "Nenhuma máquina vinculada";
  const scriptSummary = scriptNames.length ? scriptNames.join(", ") : "Nenhuma verificação selecionada";
  const titleScope = assetIds.length === 1 ? assetIds[0] : `${assetIds.length} máquina(s)`;
  const title = `Manutenção preventiva — ${titleScope}`;
  const description =
    `OS preventiva criada a partir do plano preventivo '${plan.name}'. ` +
    `Máquinas selecionadas: ${assetSummary}. ` +
    `Verificações selecionadas: ${scriptSummary}. ` +
    "Nenhum comando foi executado automaticamente.";

  const serviceOrder = await createServiceOrder({
    payload: {
      title,
      description,
      priority: "low",
      category: "Preventiva",
      problemType: "Manutenção preventiva",
      serviceName: "Manutenção preventiva",
      source: "Plano Preventivo",
      requesterName: user?.name || "Técnico",
      assignedTechnicianName: user?.name || null,
      assetId: assetIds.length === 1 ? assetIds[0] : null,
      relatedAssetText: assetSummary,
      notes: [
        `Origem: Plano Preventivo`,
        `Plano preventivo: ${plan.name}`,
        `Verificações selecionadas: ${scriptSummary}`,
        "Nenhum comando foi executado automaticamente."
      ].join("\n"),
      preventivePlanId: plan.id,
      autoPriorityEnabled: false
    },
    user
  });

  await query(
    `
      UPDATE preventive_plans
      SET service_order_id = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [plan.id, serviceOrder.id]
  );

  await addServiceOrderHistory({
    serviceOrderId: serviceOrder.id,
    eventType: "preventive_plan_origin",
    message: `OS criada a partir do plano preventivo ${plan.name}.`,
    oldValue: null,
    newValue: plan.id,
    user
  });

  await Promise.all(assetIds.map((assetId) =>
    addAssetHistory({
      assetId,
      eventType: "preventive_plan_service_order",
      message: `Plano preventivo ${plan.name} gerou a OS preventiva ${serviceOrder.number}.`,
      newValue: serviceOrder.number,
      userId: user?.id || null,
      userName: user?.name || user?.email || "Sistema"
    })
  ));

  await addLog({
    type: "preventive_plan_service_order_created",
    message: `Plano preventivo ${plan.name} gerou a OS preventiva ${serviceOrder.number}.`,
    userId: user?.id || null,
    meta: {
      preventivePlanId: plan.id,
      serviceOrderId: serviceOrder.id,
      serviceOrderNumber: serviceOrder.number,
      assetCount: assetIds.length
    }
  });

  return {
    preventivePlan: await findPreventivePlanById(plan.id),
    serviceOrder
  };
}

export async function listPreventivePlanLogs(id) {
  const plan = await findPreventivePlanById(id);
  if (!plan) return null;
  return plan.assets.map((asset) => ({
    id: asset.id,
    assetId: asset.assetId,
    status: asset.status,
    log: asset.log,
    preparedAt: asset.preparedAt
  }));
}
