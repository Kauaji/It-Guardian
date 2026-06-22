import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import { addLog } from "./logRepository.js";
import { findMaintenanceScriptById } from "./maintenanceScriptRepository.js";
import { addServiceOrderHistory, createServiceOrder, findServiceOrderById } from "./serviceOrderRepository.js";
import {
  createPreventiveAutomationPlanRecord,
  findPreventiveAutomationPlanByPreventivePlanId
} from "./preventiveAutomationRepository.js";

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

async function hydratePlan(plan, db = query) {
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

function summarizeAutomation(automation) {
  if (!automation) return { enabled: false };
  return {
    enabled: true,
    id: automation.id,
    preventivePlanId: automation.preventivePlanId,
    name: automation.name,
    active: automation.active !== false,
    recurrenceType: automation.recurrenceType,
    recurrenceInterval: automation.recurrenceInterval,
    recurrenceIntervalDays: automation.recurrenceIntervalDays,
    preferredTime: automation.preferredTime,
    timezone: automation.timezone,
    scopeType: automation.scopeType,
    scopeId: automation.scopeId,
    assetIds: automation.assetIds || [],
    defaultScriptIds: automation.defaultScriptIds || [],
    notes: automation.notes || "",
    indicatorColor: automation.indicatorColor,
    nextRunAt: automation.nextRunAt,
    nextScheduledFor: automation.nextScheduledFor,
    overrideCount: automation.overrideCount || 0,
    overrides: automation.overrides || [],
    assetSchedules: automation.assetSchedules || []
  };
}

async function attachAutomation(plan) {
  if (!plan) return null;
  const automation = await findPreventiveAutomationPlanByPreventivePlanId(plan.id);
  return {
    ...plan,
    automation: summarizeAutomation(automation)
  };
}

async function attachAutomations(plans) {
  return Promise.all(plans.map((plan) => attachAutomation(plan)));
}

export async function listPreventivePlans() {
  const result = await query(`
    SELECT plans.*,
           orders.id AS linked_service_order_id,
           orders.number AS linked_service_order_number,
           orders.title AS linked_service_order_title,
           orders.status AS linked_service_order_status
    FROM preventive_plans plans
    LEFT JOIN service_orders orders ON orders.id = plans.service_order_id
    ORDER BY plans.created_at DESC
  `);

  const plans = await Promise.all(result.rows.map((row) => hydratePlan(fromPlanRow(row))));
  return attachAutomations(plans);
}

export async function findPreventivePlanById(id) {
  const result = await query(
    `
      SELECT plans.*,
             orders.id AS linked_service_order_id,
             orders.number AS linked_service_order_number,
             orders.title AS linked_service_order_title,
             orders.status AS linked_service_order_status
      FROM preventive_plans plans
      LEFT JOIN service_orders orders ON orders.id = plans.service_order_id
      WHERE plans.id = $1
    `,
    [id]
  );
  return attachAutomation(await hydratePlan(result.rows[0] ? fromPlanRow(result.rows[0]) : null));
}

async function lockPreventivePlanById(id, db) {
  try {
    const result = await db("SELECT * FROM preventive_plans WHERE id = $1 FOR UPDATE", [id]);
    return result.rows[0] ? fromPlanRow(result.rows[0]) : null;
  } catch (error) {
    if (!/FOR UPDATE|syntax|parse/i.test(error.message || "")) throw error;
    const result = await db("SELECT * FROM preventive_plans WHERE id = $1", [id]);
    return result.rows[0] ? fromPlanRow(result.rows[0]) : null;
  }
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

  const automationEnabled = payload.automation?.enabled === true;
  const planId = randomUUID();
  const createdPlanId = await withTransaction(async (db) => {
    const planResult = await db(
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

    for (const [index, script] of scripts.entries()) {
      await db(
        `
          INSERT INTO preventive_plan_scripts (id, preventive_plan_id, script_id, order_index)
          VALUES ($1, $2, $3, $4)
        `,
        [randomUUID(), planId, script.id, index]
      );
    }

    const scriptNames = scripts.map((script) => script.name).join(", ");
    const userName = user?.name || "Usuário";

    for (const assetId of normalized.assetIds) {
      const log =
        `Preventiva registrada para ${assetId} com as verificações: ${scriptNames}. ` +
        "Nenhum comando foi executado nesta versão.";

      await db(
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
        userName,
        db
      });
    }

    await addLog({
      type: "preventive_plan_created",
      message: `Plano preventivo registrado: ${normalized.name}. Nenhum comando foi executado.`,
      userId: user?.id || null,
      meta: {
        preventivePlanId: planId,
        assetCount: normalized.assetIds.length,
        scriptCount: scripts.length,
        source: normalized.source
      },
      db
    });

    if (automationEnabled) {
      const automationPayload = payload.automation || {};
      const automationId = await createPreventiveAutomationPlanRecord(
        {
          ...automationPayload,
          preventivePlanId: planId,
          name: trimString(automationPayload.name, 120, normalized.name),
          description: trimString(automationPayload.description, 1000, normalized.description),
          notes: trimString(automationPayload.notes, 1000, normalized.notes),
          scopeType: "asset_list",
          scopeId: null,
          assetIds: normalized.assetIds,
          defaultScriptIds: normalized.scriptIds,
          active: automationPayload.active !== false
        },
        user,
        db
      );

      for (const assetId of normalized.assetIds) {
        await addAssetHistory({
          assetId,
          eventType: "preventive_automation_enabled",
          message: `Plano preventivo '${normalized.name}' recebeu automacao vinculada.`,
          newValue: automationId,
          userId: user?.id || null,
          userName,
          db
        });
      }

      await addLog({
        type: "preventive_plan_automation_linked",
        message: `Automacao vinculada ao plano preventivo: ${normalized.name}.`,
        userId: user?.id || null,
        meta: {
          preventivePlanId: planId,
          preventiveAutomationPlanId: automationId,
          assetCount: normalized.assetIds.length,
          scriptCount: normalized.scriptIds.length
        },
        db
      });
    }

    return planResult.rows[0].id;
  });

  return findPreventivePlanById(createdPlanId);
}

export async function preparePreventivePlan(id, user = null) {
  const preparedPlanId = await withTransaction(async (db) => {
    const plan = await hydratePlan(await lockPreventivePlanById(id, db), db);
    if (!plan) return null;

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

    await db(
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
      meta: { preventivePlanId: id },
      db
    });

    return id;
  });

  return preparedPlanId ? findPreventivePlanById(preparedPlanId) : null;
}

export async function createServiceOrderFromPreventivePlan(id, user = null) {
  const result = await withTransaction(async (db) => {
    const plan = await hydratePlan(await lockPreventivePlanById(id, db), db);
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

    let serviceOrder;
    try {
      serviceOrder = await createServiceOrder({
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
            "Origem: Plano Preventivo",
            `Plano preventivo: ${plan.name}`,
            `Verificações selecionadas: ${scriptSummary}`,
            "Nenhum comando foi executado automaticamente."
          ].join("\n"),
          preventivePlanId: plan.id,
          autoPriorityEnabled: false
        },
        user,
        db
      });
    } catch (error) {
      if (error?.code === "23505") {
        const conflict = new Error("Este plano já possui uma OS preventiva vinculada.");
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    }

    const updateResult = await db(
      `
        UPDATE preventive_plans
        SET service_order_id = $2,
            updated_at = NOW()
        WHERE id = $1
          AND service_order_id IS NULL
        RETURNING id
      `,
      [plan.id, serviceOrder.id]
    );

    if (!updateResult.rowCount) {
      const error = new Error("Este plano já possui uma OS preventiva vinculada.");
      error.statusCode = 409;
      throw error;
    }

    await addServiceOrderHistory({
      serviceOrderId: serviceOrder.id,
      eventType: "preventive_plan_origin",
      message: `OS criada a partir do plano preventivo ${plan.name}.`,
      oldValue: null,
      newValue: plan.id,
      user,
      db
    });

    for (const assetId of assetIds) {
      await addAssetHistory({
        assetId,
        eventType: "preventive_plan_service_order",
        message: `Plano preventivo ${plan.name} gerou a OS preventiva ${serviceOrder.number}.`,
        newValue: serviceOrder.number,
        userId: user?.id || null,
        userName: user?.name || user?.email || "Sistema",
        db
      });
    }

    await addLog({
      type: "preventive_plan_service_order_created",
      message: `Plano preventivo ${plan.name} gerou a OS preventiva ${serviceOrder.number}.`,
      userId: user?.id || null,
      meta: {
        preventivePlanId: plan.id,
        serviceOrderId: serviceOrder.id,
        serviceOrderNumber: serviceOrder.number,
        assetCount: assetIds.length
      },
      db
    });

    return {
      preventivePlanId: plan.id,
      serviceOrderId: serviceOrder.id
    };
  });

  if (!result) return null;

  return {
    preventivePlan: await findPreventivePlanById(result.preventivePlanId),
    serviceOrder: await findServiceOrderById(result.serviceOrderId)
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
