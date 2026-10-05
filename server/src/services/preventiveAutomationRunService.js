import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { trimString } from "../lib/textUtils.js";
import { actorName, normalizeScheduleSlot, toValidDate } from "../domain/preventiveAutomationNormalizers.js";
import { buildRunDraft, recurrenceFromSchedule } from "../domain/preventiveAutomationRun.js";
import { resolveEffectiveRecurrence } from "../domain/preventiveAutomationSchedule.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import { queueAgentScriptJob } from "../repositories/agentScriptJobRepository.js";
import { addLog } from "../repositories/logRepository.js";
import { createScriptSimulationLog, refreshDueScriptValidations } from "../repositories/maintenanceScriptRepository.js";
import { markPlanPrepared } from "../repositories/preventiveAutomationPlanRepository.js";
import { findRunBySlot, insertRun } from "../repositories/preventiveAutomationRunRepository.js";
import {
  listActiveSchedulesByIds,
  listDueSchedulesForPlan,
  markSchedulePrepared
} from "../repositories/preventiveAutomationScheduleRepository.js";
import { syncAutoPriorities, syncSlaBreaches } from "./serviceOrders/serviceOrderSlaSyncService.js";
import {
  findPreventiveAutomationPlanById,
  listDuePreventiveAutomationPlans
} from "./preventiveAutomationPlanQueryService.js";
import { refreshPlanNextRun } from "./preventiveAutomationScheduleService.js";
import { validatePlanForPreparation } from "./preventiveAutomationScopeService.js";
import { backfillPreventiveAutomationAssetSchedules } from "./preventiveAutomationBackfillService.js";

/**
 * Preparo de execucoes: cria uma run por maquina, enfileira os scripts para o
 * agente autenticado e reagenda. Nenhum comando e executado no servidor.
 */

/** Cria a execucao e os jobs do agente; se a janela ja foi preparada, reaproveita a existente. */
async function insertPreparedRun({ plan, asset, recurrence, scheduledFor, scripts, user, triggerType = "scheduled", db = query }) {
  const existingRun = await findRunBySlot(plan.id, asset.id, scheduledFor, db);
  if (existingRun) return { run: existingRun, created: false };

  const draft = buildRunDraft({ id: randomUUID(), plan, asset, recurrence, scheduledFor, scripts, triggerType });

  try {
    const run = await insertRun(db, draft);
    const jobs = await queueScriptJobs({ plan, asset, run, scripts, user, db });
    await addAssetHistory({
      assetId: asset.id,
      eventType: "preventive_automation_queued",
      message: `Automação preventiva '${plan.name}' enfileirada e aguardando o agente da máquina.`,
      newValue: JSON.stringify({
        automationRunId: run.id,
        scheduledFor,
        scriptNames: scripts.map((script) => script.name),
        jobIds: jobs.map((job) => job.id)
      }),
      userId: user?.id || null,
      userName: actorName(user),
      db
    });

    return { run, created: true };
  } catch (error) {
    if (error.code === "23505" || /unique/i.test(error.message || "")) {
      const run = await findRunBySlot(plan.id, asset.id, scheduledFor, db);
      if (run) return { run, created: false };
    }

    throw error;
  }
}

async function queueScriptJobs({ plan, asset, run, scripts, user, db }) {
  const jobs = [];
  for (const script of scripts) {
    const executionLog = await createScriptSimulationLog({
      scriptId: script.id,
      assetId: asset.id,
      preventivePlanId: plan.preventivePlanId,
      mode: "agent",
      status: "queued",
      executedBy: user?.id || null,
      notes: plan.notes,
      rawLog: "Automação preventiva enfileirada e aguardando o agente autenticado.",
      parsedSummary: `Script '${script.name}' aguardando execução pelo agente.`,
      errorDetected: false,
      attentionRequired: false,
      db
    });
    jobs.push(await queueAgentScriptJob({
      script,
      assetId: asset.id,
      executionLogId: executionLog.id,
      automationRunId: run.id,
      userId: user?.id || null,
      db
    }));
  }
  return jobs;
}

/** Agendas vencidas do plano (ou as agendas explicitamente informadas em `scheduleIds`). */
export async function listDueAssetSchedulesForPlan(planId, options = {}, db = query) {
  const now = toValidDate(options.now || new Date()).toISOString();
  const scheduleIds = Array.isArray(options.scheduleIds)
    ? options.scheduleIds.map((item) => trimString(item, 120)).filter(Boolean)
    : [];

  if (scheduleIds.length) {
    return listActiveSchedulesByIds(planId, scheduleIds, db);
  }
  return listDueSchedulesForPlan(planId, now, db);
}

function resolvePreparationTargets({ assets, triggerType, dueSchedules }) {
  if (triggerType !== "scheduled") {
    return assets.map((asset) => ({ asset, schedule: null }));
  }

  const assetById = new Map(assets.map((asset) => [String(asset.id), asset]));
  return dueSchedules
    .map((schedule) => ({ schedule, asset: assetById.get(String(schedule.assetId)) }))
    .filter((item) => item.asset);
}

async function prepareTargets(db, { plan, targets, scripts, user, triggerType, manualScheduledFor }) {
  const runs = [];
  let createdRuns = 0;

  for (const target of targets) {
    const recurrence = target.schedule
      ? recurrenceFromSchedule(target.schedule)
      : resolveEffectiveRecurrence(plan, target.asset);
    const scheduledFor = triggerType === "scheduled"
      ? normalizeScheduleSlot(target.schedule.nextRunAt)
      : manualScheduledFor;
    const { run, created } = await insertPreparedRun({
      plan,
      asset: target.asset,
      recurrence,
      scheduledFor,
      scripts,
      user,
      triggerType,
      db
    });

    runs.push(run);
    if (created) createdRuns += 1;

    if (triggerType === "scheduled" && target.schedule) {
      await markSchedulePrepared(db, { id: target.schedule.id, scheduledFor, nextRunAt: run.nextRunAt });
    }
  }

  return { runs, createdRuns };
}

async function recordPlanPreparation(db, { plan, runs, createdRuns, targetCount, triggerType, user }) {
  const scheduled = triggerType === "scheduled";
  const nextRunAt = scheduled ? await refreshPlanNextRun(plan.id, db) : plan.nextRunAt;

  await markPlanPrepared(db, {
    id: plan.id,
    preparedAt: new Date().toISOString(),
    lastScheduledAt: scheduled ? runs[0]?.scheduledFor : null,
    nextRunAt
  });

  await addLog({
    type: scheduled ? "preventive_automation_scheduled_prepared" : "preventive_automation_manual_prepared",
    message: `Automação preventiva preparada: ${plan.name}. Rotina aguardando agente seguro.`,
    userId: user?.id || null,
    meta: {
      preventiveAutomationPlanId: plan.id,
      assetCount: targetCount,
      runCount: createdRuns,
      triggerType,
      nextRunAt
    },
    db
  });
}

export async function preparePreventiveAutomationPlan(id, user = null, options = {}) {
  const plan = await findPreventiveAutomationPlanById(id, user);
  if (!plan) return null;

  const { scripts, assets } = await validatePlanForPreparation(plan);
  const triggerType = options.triggerType || (options.scheduleIds ? "scheduled" : "manual");
  const manualScheduledFor = normalizeScheduleSlot(options.scheduledFor || new Date());
  const dueSchedules = triggerType === "scheduled"
    ? await listDueAssetSchedulesForPlan(plan.id, options)
    : [];
  const targets = resolvePreparationTargets({ assets, triggerType, dueSchedules });

  if (triggerType === "scheduled" && !targets.length) {
    return {
      preventiveAutomationPlan: plan,
      runs: [],
      preparedCount: 0,
      skippedExistingCount: 0
    };
  }

  const outcome = await withTransaction(async (db) => {
    const prepared = await prepareTargets(db, { plan, targets, scripts, user, triggerType, manualScheduledFor });
    if (prepared.createdRuns > 0) {
      await recordPlanPreparation(db, {
        plan,
        runs: prepared.runs,
        createdRuns: prepared.createdRuns,
        targetCount: targets.length,
        triggerType,
        user
      });
    }
    return prepared;
  });

  return {
    preventiveAutomationPlan: await findPreventiveAutomationPlanById(plan.id),
    runs: outcome.runs,
    preparedCount: outcome.createdRuns,
    skippedExistingCount: outcome.runs.length - outcome.createdRuns
  };
}

async function processDuePlan(plan, user) {
  const dueSchedules = await listDueAssetSchedulesForPlan(plan.id);
  const result = await preparePreventiveAutomationPlan(plan.id, user, {
    triggerType: "scheduled",
    scheduleIds: dueSchedules.map((schedule) => schedule.id)
  });
  const preparedCount = Number(result?.preparedCount || 0);

  return {
    planId: plan.id,
    status: preparedCount > 0 ? "prepared" : "skipped",
    preparedCount,
    skippedExistingCount: Number(result?.skippedExistingCount || 0),
    message: preparedCount > 0 ? "Plano preparado." : "Nenhuma máquina vencida para preparar."
  };
}

export async function processDuePreventiveAutomationPlans(user = null) {
  const duePlans = await listDuePreventiveAutomationPlans();
  const plans = [];
  let preparedPlans = 0;
  let preparedRuns = 0;
  let skippedPlans = 0;
  let failedPlans = 0;

  for (const plan of duePlans) {
    try {
      const entry = await processDuePlan(plan, user);
      if (entry.preparedCount > 0) preparedPlans += 1;
      else skippedPlans += 1;
      preparedRuns += entry.preparedCount;
      plans.push(entry);
    } catch (error) {
      failedPlans += 1;
      plans.push({
        planId: plan.id,
        status: "failed",
        preparedCount: 0,
        message: error.message
      });
      await addLog({
        type: "preventive_automation_scheduler_plan_failed",
        message: `Falha ao processar plano preventivo ${plan.id}: ${error.message}`,
        userId: user?.id || null,
        meta: { preventiveAutomationPlanId: plan.id }
      });
    }
  }

  return {
    duePlanCount: duePlans.length,
    preparedPlanCount: preparedPlans,
    preparedRunCount: preparedRuns,
    skippedPlanCount: skippedPlans,
    failedPlanCount: failedPlans,
    plans
  };
}

/** Rotinas do scheduler: backfill de agendas, preventivas vencidas, validacoes de script e OS. */
export async function processScheduledMaintenanceTasks(user = null) {
  const backfill = await backfillPreventiveAutomationAssetSchedules({ user });
  const preventiveAutomation = await processDuePreventiveAutomationPlans(user);
  const scriptValidations = await refreshDueScriptValidations({ summary: true });
  const serviceOrderAutoPriority = await syncAutoPriorities();
  const serviceOrderSlaBreaches = await syncSlaBreaches();

  return {
    backfill,
    preventiveAutomation,
    scriptValidations,
    serviceOrderAutoPriority,
    serviceOrderSlaBreaches
  };
}
