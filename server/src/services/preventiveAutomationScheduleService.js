import { randomUUID } from "node:crypto";
import { query } from "../database.js";
import { buildAssetScheduleDraft, getAssetScheduleSyncActions } from "../domain/preventiveAutomationSchedule.js";
import { updatePlanNextRun } from "../repositories/preventiveAutomationPlanRepository.js";
import {
  deactivateScheduleById,
  findEarliestNextRun,
  listSchedulesByPlan,
  upsertSchedule
} from "../repositories/preventiveAutomationScheduleRepository.js";

/**
 * Sincronizacao das agendas por maquina com o estado do plano: cria ou atualiza
 * a agenda de cada maquina do escopo, desativa as que sairam e reflete a
 * proxima execucao mais proxima no plano.
 */

/** Atualiza `next_run_at` do plano com a menor proxima execucao das agendas ativas. */
export async function refreshPlanNextRun(planId, db = query) {
  const nextRunAt = await findEarliestNextRun(planId, db);
  await updatePlanNextRun(db, planId, nextRunAt);
  return nextRunAt;
}

export async function syncAssetSchedulesForPlan(plan, assets, db = query) {
  const existingSchedules = await listSchedulesByPlan(plan.id, db);
  const existingByAsset = new Map(existingSchedules.map((schedule) => [String(schedule.assetId), schedule]));
  const syncActions = getAssetScheduleSyncActions(
    existingSchedules,
    assets.map((asset) => asset.id)
  );
  const scheduleAnchorAt = plan.scheduleAnchorAt || plan.createdAt || new Date().toISOString();
  const planWithAnchor = { ...plan, scheduleAnchorAt };

  for (const asset of assets) {
    const existing = existingByAsset.get(String(asset.id));
    const draft = buildAssetScheduleDraft({ plan: planWithAnchor, asset, existing });

    await upsertSchedule(db, {
      id: existing?.id || randomUUID(),
      planId: plan.id,
      assetId: asset.id,
      ...draft
    });
  }

  for (const scheduleId of syncActions.disable) {
    await deactivateScheduleById(db, scheduleId);
  }

  return refreshPlanNextRun(plan.id, db);
}
