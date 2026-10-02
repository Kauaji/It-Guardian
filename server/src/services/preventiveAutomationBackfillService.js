import { withTransaction } from "../database.js";
import { classifyScheduleChange } from "../domain/preventiveAutomationSchedule.js";
import { addLog } from "../repositories/logRepository.js";
import { listAllPlans } from "../repositories/preventiveAutomationPlanRepository.js";
import { listOverridesByPlan } from "../repositories/preventiveAutomationOverrideRepository.js";
import { listSchedulesByPlan } from "../repositories/preventiveAutomationScheduleRepository.js";
import { ensurePlanSchedule } from "./preventiveAutomationPlanQueryService.js";
import { resolvePlanAssets } from "./preventiveAutomationScopeService.js";
import { syncAssetSchedulesForPlan } from "./preventiveAutomationScheduleService.js";

/**
 * Reconstroi as agendas por maquina de todos os planos (usado na inicializacao
 * e no scheduler). Falha em um plano nao interrompe os demais.
 */

function emptySummary(analyzedPlanCount) {
  return {
    analyzedPlanCount,
    createdScheduleCount: 0,
    updatedScheduleCount: 0,
    ignoredScheduleCount: 0,
    deactivatedScheduleCount: 0,
    failedPlanCount: 0,
    plans: []
  };
}

function countScheduleChanges(beforeSchedules, afterSchedules) {
  const beforeByAsset = new Map(beforeSchedules.map((schedule) => [String(schedule.assetId), schedule]));
  const counts = { created: 0, updated: 0, ignored: 0, deactivated: 0 };

  for (const after of afterSchedules) {
    const change = classifyScheduleChange(beforeByAsset.get(String(after.assetId)), after);
    counts[change] += 1;
  }

  return counts;
}

async function backfillPlanSchedules(plan) {
  const overrides = await listOverridesByPlan(plan.id);
  const planWithOverrides = { ...plan, overrides };
  const before = await listSchedulesByPlan(plan.id);
  const assets = await resolvePlanAssets(planWithOverrides);

  await withTransaction(async (db) => {
    await syncAssetSchedulesForPlan(planWithOverrides, assets, db);
  });

  const after = await listSchedulesByPlan(plan.id);
  return { assetCount: assets.length, ...countScheduleChanges(before, after) };
}

function recordPlanResult(summary, planId, outcome) {
  summary.createdScheduleCount += outcome.created;
  summary.updatedScheduleCount += outcome.updated;
  summary.ignoredScheduleCount += outcome.ignored;
  summary.deactivatedScheduleCount += outcome.deactivated;
  summary.plans.push({
    planId,
    status: "ok",
    assetCount: outcome.assetCount,
    created: outcome.created,
    updated: outcome.updated,
    ignored: outcome.ignored,
    deactivated: outcome.deactivated
  });
}

export async function backfillPreventiveAutomationAssetSchedules({ user = null } = {}) {
  const storedPlans = await listAllPlans();
  const summary = emptySummary(storedPlans.length);

  for (const storedPlan of storedPlans) {
    const plan = await ensurePlanSchedule(storedPlan);

    try {
      recordPlanResult(summary, plan.id, await backfillPlanSchedules(plan));
    } catch (error) {
      summary.failedPlanCount += 1;
      summary.plans.push({
        planId: plan.id,
        status: "failed",
        message: error.message
      });
    }
  }

  await addLog({
    type: "preventive_automation_schedule_backfill",
    message:
      `Backfill de agendas preventivas: ${summary.createdScheduleCount} criada(s), ` +
      `${summary.updatedScheduleCount} atualizada(s), ${summary.failedPlanCount} falha(s).`,
    userId: user?.id || null,
    meta: {
      analyzedPlanCount: summary.analyzedPlanCount,
      createdScheduleCount: summary.createdScheduleCount,
      updatedScheduleCount: summary.updatedScheduleCount,
      ignoredScheduleCount: summary.ignoredScheduleCount,
      deactivatedScheduleCount: summary.deactivatedScheduleCount,
      failedPlanCount: summary.failedPlanCount
    }
  });

  return summary;
}
