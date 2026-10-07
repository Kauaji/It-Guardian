import { serializeTimestamp } from "../lib/textUtils.js";
import { computeNextScheduledFor } from "../domain/preventiveSchedule.js";
import { normalizePagination, toValidDate } from "../domain/preventiveAutomationNormalizers.js";
import { canAccessAutomationPlan } from "../repositories/automationAccessScope.js";
import {
  fillMissingPlanSchedule,
  findActivePlanById,
  findActivePlanByPreventivePlanId,
  listActivePlans,
  listDuePlans
} from "../repositories/preventiveAutomationPlanRepository.js";
import { listOverridesByPlan } from "../repositories/preventiveAutomationOverrideRepository.js";
import { listRunsByPlan } from "../repositories/preventiveAutomationRunRepository.js";
import { listSchedulesByPlan } from "../repositories/preventiveAutomationScheduleRepository.js";

/**
 * Leitura de planos de automacao ja hidratados (overrides, agendas por maquina
 * e execucoes recentes), com aplicacao do escopo do usuario.
 */

/**
 * Planos legados podem nao ter ancora/proxima execucao: calcula e persiste
 * somente o que falta, sem sobrescrever valores existentes.
 */
export async function ensurePlanSchedule(plan) {
  if (!plan) return null;
  if (plan.nextRunAt && plan.scheduleAnchorAt) return plan;

  const scheduleAnchorAt = plan.scheduleAnchorAt || serializeTimestamp(plan.createdAt || new Date());
  const nextRunAt = plan.nextRunAt || computeNextScheduledFor(plan, scheduleAnchorAt);
  const lastScheduledAt = plan.lastScheduledAt || nextRunAt;

  await fillMissingPlanSchedule(plan.id, { scheduleAnchorAt, nextRunAt, lastScheduledAt });

  return {
    ...plan,
    scheduleAnchorAt,
    nextRunAt,
    nextScheduledFor: nextRunAt,
    lastScheduledAt
  };
}

export async function hydratePlan(plan) {
  if (!plan) return null;

  const [overrides, runs, assetSchedules] = await Promise.all([
    listOverridesByPlan(plan.id),
    listRunsByPlan(plan.id),
    listSchedulesByPlan(plan.id)
  ]);

  return {
    ...plan,
    overrides,
    assetSchedules,
    overrideCount: overrides.filter((override) => override.active !== false).length,
    latestRun: runs[0] || null,
    recentRuns: runs.slice(0, 10)
  };
}

async function ensureAndHydrate(plans) {
  const prepared = [];
  for (const plan of plans) {
    prepared.push(await ensurePlanSchedule(plan));
  }
  return Promise.all(prepared.map(hydratePlan));
}

export async function listPreventiveAutomationPlans(user = null, options = {}) {
  const plans = await listActivePlans();
  const allowedPlans = plans.filter((plan) => canAccessAutomationPlan(plan, user));
  const limit = normalizePagination(options.limit, 100, 500);
  const offset = normalizePagination(options.offset, 0, 100000);

  return ensureAndHydrate(allowedPlans.slice(offset, offset + limit));
}

export async function findPreventiveAutomationPlanById(id, user = null) {
  const plan = await findActivePlanById(id);
  if (!canAccessAutomationPlan(plan, user)) return null;
  return hydratePlan(await ensurePlanSchedule(plan));
}

export async function findPreventiveAutomationPlanByPreventivePlanId(preventivePlanId) {
  const plan = await findActivePlanByPreventivePlanId(preventivePlanId);
  return hydratePlan(await ensurePlanSchedule(plan));
}

export async function listDuePreventiveAutomationPlans(now = new Date()) {
  const plans = await listDuePlans(toValidDate(now).toISOString());
  return ensureAndHydrate(plans);
}
