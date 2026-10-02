import { withTransaction } from "../database.js";
import { notFoundError } from "../lib/errors.js";
import { normalizeOverridePayload } from "../domain/preventiveAutomationPayload.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import { addLog } from "../repositories/logRepository.js";
import { updatePlanAssetScope } from "../repositories/preventiveAutomationPlanRepository.js";
import {
  deleteOverrideByTarget,
  insertOverride
} from "../repositories/preventiveAutomationOverrideRepository.js";
import { deactivateAssetSchedule } from "../repositories/preventiveAutomationScheduleRepository.js";
import { findPreventiveAutomationPlanById } from "./preventiveAutomationPlanQueryService.js";
import { findPreventiveAutomationAssetDetails } from "./preventiveAutomationManagementService.js";
import { actorName } from "./preventiveAutomationPlanService.js";
import { syncAssetSchedulesForPlan } from "./preventiveAutomationScheduleService.js";
import { validateScopeSelection } from "./preventiveAutomationScopeService.js";

/**
 * Operacoes por maquina dentro de um plano: recorrencia personalizada
 * (override) e remocao da maquina do plano.
 */

const assetNotInPlanMessage = "A maquina nao pertence a este plano de automacao.";

function assetTargetKey(assetId) {
  return `asset:${assetId}`;
}

export async function upsertPreventiveAutomationAssetOverride(planId, assetId, payload = {}, user = null) {
  const current = await findPreventiveAutomationPlanById(planId, user);
  if (!current) return null;
  const schedule = current.assetSchedules.find((item) => String(item.assetId) === String(assetId));
  if (!schedule) throw notFoundError(assetNotInPlanMessage);
  const normalized = normalizeOverridePayload({ ...payload, assetId, segmentId: null });

  await withTransaction(async (db) => {
    await deleteOverrideByTarget(db, planId, assetTargetKey(assetId));
    await insertOverride(db, planId, { ...normalized, targetKey: assetTargetKey(assetId) });
    const assets = await validateScopeSelection(current, { user });
    const overrides = [
      ...current.overrides.filter((item) => String(item.assetId || "") !== String(assetId)),
      normalized
    ];
    await syncAssetSchedulesForPlan({ ...current, overrides }, assets, db);
    await addAssetHistory({
      assetId,
      eventType: "preventive_automation_asset_override_updated",
      message:
        `Recorrência personalizada atualizada no plano '${current.name}': ` +
        `${normalized.recurrenceType}, ${normalized.recurrenceInterval} dia(s).`,
      userId: user?.id || null,
      userName: actorName(user),
      db
    });
    await addLog({
      type: "preventive_automation_asset_override_updated",
      message: `Recorrencia personalizada atualizada para a maquina ${assetId}.`,
      userId: user?.id || null,
      meta: { planId, assetId, targetKey: assetTargetKey(assetId) },
      db
    });
  });

  return findPreventiveAutomationAssetDetails(planId, assetId, user);
}

export async function removePreventiveAutomationAssetOverride(planId, assetId, user = null) {
  const current = await findPreventiveAutomationPlanById(planId, user);
  if (!current) return null;

  await withTransaction(async (db) => {
    await deleteOverrideByTarget(db, planId, assetTargetKey(assetId));
    const assets = await validateScopeSelection(current, { user });
    const overrides = current.overrides.filter((item) => String(item.assetId || "") !== String(assetId));
    await syncAssetSchedulesForPlan({ ...current, overrides }, assets, db);
    await addAssetHistory({
      assetId,
      eventType: "preventive_automation_asset_override_removed",
      message: `Recorrência personalizada removida. A máquina voltou a herdar a configuração do plano '${current.name}'.`,
      userId: user?.id || null,
      userName: actorName(user),
      db
    });
    await addLog({
      type: "preventive_automation_asset_override_removed",
      message: `Maquina ${assetId} voltou a usar a recorrencia padrao do plano ${current.name}.`,
      userId: user?.id || null,
      meta: { planId, assetId },
      db
    });
  });

  return findPreventiveAutomationAssetDetails(planId, assetId, user);
}

/**
 * Remove a maquina da lista (asset_list) ou a adiciona as exclusoes (escopos
 * amplos), desativa so a agenda dela e preserva runs e historico.
 */
export async function removeAssetFromPreventiveAutomationPlan(planId, assetId, user = null) {
  const current = await findPreventiveAutomationPlanById(planId, user);
  if (!current) return null;
  const schedule = current.assetSchedules.find(
    (item) => String(item.assetId) === String(assetId) && item.active !== false
  );
  if (!schedule) throw notFoundError(assetNotInPlanMessage);

  const isAssetList = current.scopeType === "asset_list";
  const nextAssetIds = isAssetList
    ? current.assetIds.filter((id) => String(id) !== String(assetId))
    : current.assetIds;
  const nextExcludedAssetIds = isAssetList
    ? current.excludedAssetIds
    : [...new Set([...current.excludedAssetIds, String(assetId)])];
  const remainingAssetCount = current.assetSchedules.filter(
    (item) => item.active !== false && String(item.assetId) !== String(assetId)
  ).length;

  await withTransaction(async (db) => {
    await updatePlanAssetScope(db, {
      id: planId,
      assetIds: nextAssetIds,
      excludedAssetIds: nextExcludedAssetIds,
      remainingAssetCount
    });
    await deactivateAssetSchedule(db, planId, assetId);
    await deleteOverrideByTarget(db, planId, assetTargetKey(assetId));
    await addAssetHistory({
      assetId,
      eventType: "preventive_automation_removed_from_asset",
      message: `Maquina removida do plano de automatizacao '${current.name}'. Agendas futuras desativadas. Historico preservado.`,
      userId: user?.id || null,
      userName: user?.name || "Sistema",
      db
    });
    await addLog({
      type: "preventive_automation_removed_from_asset",
      message: `Maquina ${assetId} removida do plano de automacao ${current.name}.`,
      userId: user?.id || null,
      meta: { planId, assetId, remainingAssetCount },
      db
    });
  });

  return { planId, assetId, remainingAssetCount, planActive: remainingAssetCount > 0 && current.active !== false };
}
