import { randomUUID } from "node:crypto";
import { withTransaction } from "../database.js";
import { badRequest } from "../lib/errors.js";
import {
  assertRiskAcknowledged,
  buildAssetRegistrationLog,
  buildLinkedAutomationPayload,
  normalizePreventivePlanPayload
} from "../domain/preventivePlanPayload.js";
import { queueAgentScriptJob } from "./agentScriptJobService.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import { addLog } from "../repositories/logRepository.js";
import { createScriptSimulationLog, findMaintenanceScriptById } from "./maintenanceScripts/maintenanceScriptsFacade.js";
import { insertPlan, insertPlanAsset, insertPlanScript } from "../repositories/preventivePlanRepository.js";
import { createPreventiveAutomationPlanRecord } from "./preventiveAutomationPlanService.js";
import { findPreventivePlanById } from "./preventivePlanReadService.js";

/**
 * Criacao do plano preventivo manual (fluxo unificado de Preventivas). Sem
 * automacao, os scripts sao enfileirados para o agente; com automacao, a
 * agenda dispara a execucao depois.
 */

async function loadActiveScripts(scriptIds) {
  const scripts = [];
  for (const scriptId of scriptIds) {
    const script = await findMaintenanceScriptById(scriptId);
    if (!script || script.active === false) {
      throw badRequest("Um dos scripts selecionados não existe ou está inativo.");
    }
    scripts.push(script);
  }
  return scripts;
}

async function queueScriptsForAsset({ planId, assetId, scripts, normalized, user, db }) {
  const jobs = [];
  for (const script of scripts) {
    const executionLog = await createScriptSimulationLog({
      scriptId: script.id,
      assetId,
      preventivePlanId: planId,
      mode: "agent",
      status: "queued",
      executedBy: user?.id || null,
      notes: normalized.notes,
      rawLog: "Verificação preventiva enfileirada e aguardando o agente autenticado.",
      parsedSummary: `Script '${script.name}' aguardando execução pelo agente.`,
      errorDetected: false,
      attentionRequired: false,
      db
    });
    jobs.push(
      await queueAgentScriptJob({
        script,
        assetId,
        executionLogId: executionLog.id,
        userId: user?.id || null,
        db
      })
    );
  }
  return jobs;
}

async function registerAsset({ planId, assetId, scripts, normalized, automationEnabled, user, db }) {
  const userName = user?.name || "Usuário";
  const scriptNames = scripts.map((script) => script.name).join(", ");

  await insertPlanAsset(db, {
    planId,
    assetId,
    status: automationEnabled ? "prepared" : "waiting_agent",
    log: buildAssetRegistrationLog({ assetId, scriptNames, automationEnabled })
  });

  const jobs = automationEnabled ? [] : await queueScriptsForAsset({ planId, assetId, scripts, normalized, user, db });

  await addAssetHistory({
    assetId,
    eventType: automationEnabled ? "preventive_plan_prepared" : "preventive_execution_queued",
    message: automationEnabled
      ? `Plano preventivo automatizado '${normalized.name}' registrado por ${userName}.`
      : `Preventiva '${normalized.name}' enfileirada por ${userName} para execução pelo agente.`,
    newValue: JSON.stringify({
      preventivePlanId: planId,
      scriptNames: scripts.map((script) => script.name),
      jobIds: jobs.map((job) => job.id),
      status: automationEnabled ? "scheduled" : "queued"
    }),
    userId: user?.id || null,
    userName,
    db
  });
}

async function linkAutomation({ planId, payload, normalized, user, db }) {
  const userName = user?.name || "Usuário";
  const automationId = await createPreventiveAutomationPlanRecord(
    buildLinkedAutomationPayload({ automationPayload: payload.automation || {}, planId, normalized }),
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

export async function createPreventivePlan(payload = {}, user = null) {
  const normalized = normalizePreventivePlanPayload(payload);
  const scripts = await loadActiveScripts(normalized.scriptIds);
  assertRiskAcknowledged(scripts, normalized.riskAcknowledged);

  const automationEnabled = payload.automation?.enabled === true;
  const planId = randomUUID();
  const createdPlanId = await withTransaction(async (db) => {
    const insertedId = await insertPlan(db, { id: planId, plan: normalized, createdBy: user?.id || null });

    for (const [index, script] of scripts.entries()) {
      await insertPlanScript(db, { planId, scriptId: script.id, orderIndex: index });
    }

    for (const assetId of normalized.assetIds) {
      await registerAsset({ planId, assetId, scripts, normalized, automationEnabled, user, db });
    }

    await addLog({
      type: "preventive_plan_created",
      message: automationEnabled
        ? `Plano preventivo automatizado registrado: ${normalized.name}.`
        : `Preventiva registrada e enfileirada no agente: ${normalized.name}.`,
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
      await linkAutomation({ planId, payload, normalized, user, db });
    }

    return insertedId;
  });

  return findPreventivePlanById(createdPlanId);
}
