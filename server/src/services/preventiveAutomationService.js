import { timingSafeEqual } from "node:crypto";
import { AppError, notFoundError, serviceUnavailable } from "../lib/errors.js";
import {
  createPreventiveAutomationPlan,
  deletePreventiveAutomationPlan,
  disablePreventiveAutomationPlan,
  findPreventiveAutomationAssetDetails,
  findPreventiveAutomationPlanById,
  listPreventiveAutomationAgenda,
  listPreventiveAutomationManagement,
  listPreventiveAutomationPlanHistory,
  listPreventiveAutomationPlans,
  preparePreventiveAutomationPlan,
  processDuePreventiveAutomationPlans,
  processScheduledMaintenanceTasks,
  reactivatePreventiveAutomationPlan,
  removeAssetFromPreventiveAutomationPlan,
  removePreventiveAutomationAssetOverride,
  upsertPreventiveAutomationAssetOverride,
  updatePreventiveAutomationPlan
} from "../repositories/preventiveAutomationRepository.js";

const notFoundMessage = "Plano de automação preventiva não encontrado.";

function safeEquals(left = "", right = "") {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getCronSecret() {
  return process.env.CRON_SECRET || process.env.PREVENTIVE_CRON_SECRET || "";
}

export async function listAllPlans(user, query) {
  return listPreventiveAutomationPlans(user, query || {});
}

export async function getManagementOverview(user, query) {
  return listPreventiveAutomationManagement(user, query || {});
}

export async function getAgenda(query, user) {
  return listPreventiveAutomationAgenda(query || {}, user);
}

export async function getPlanHistory(id, limit, user) {
  const result = await listPreventiveAutomationPlanHistory(id, { limit }, user);
  if (!result) throw notFoundError(notFoundMessage);
  return result;
}

export async function getPlanDetail(id, user) {
  const preventiveAutomationPlan = await findPreventiveAutomationPlanById(id, user);
  if (!preventiveAutomationPlan) throw notFoundError(notFoundMessage);
  return preventiveAutomationPlan;
}

export async function createPlan(payload, user) {
  return createPreventiveAutomationPlan(payload || {}, user);
}

export async function updatePlan(id, payload, user) {
  const preventiveAutomationPlan = await updatePreventiveAutomationPlan(id, payload || {}, user);
  if (!preventiveAutomationPlan) throw notFoundError(notFoundMessage);
  return preventiveAutomationPlan;
}

export async function disablePlan(id, user) {
  const preventiveAutomationPlan = await disablePreventiveAutomationPlan(id, user);
  if (!preventiveAutomationPlan) throw notFoundError(notFoundMessage);
  return preventiveAutomationPlan;
}

export async function reactivatePlan(id, user) {
  const preventiveAutomationPlan = await reactivatePreventiveAutomationPlan(id, user);
  if (!preventiveAutomationPlan) throw notFoundError(notFoundMessage);
  return preventiveAutomationPlan;
}

export async function removePlan(id, user) {
  const preventiveAutomationPlan = await deletePreventiveAutomationPlan(id, user);
  if (!preventiveAutomationPlan) throw notFoundError("Plano de automacao preventiva nao encontrado.");
  return preventiveAutomationPlan;
}

export async function getAssetDetail(id, assetId, user) {
  const automationAsset = await findPreventiveAutomationAssetDetails(id, assetId, user);
  if (!automationAsset) throw notFoundError("Vinculo de automacao da maquina nao encontrado.");
  return automationAsset;
}

export async function saveAssetOverrideForPlan(id, assetId, payload, user) {
  const automationAsset = await upsertPreventiveAutomationAssetOverride(id, assetId, payload || {}, user);
  if (!automationAsset) throw notFoundError("Plano de automacao preventiva nao encontrado.");
  return automationAsset;
}

export async function removeAssetOverrideFromPlan(id, assetId, user) {
  const automationAsset = await removePreventiveAutomationAssetOverride(id, assetId, user);
  if (!automationAsset) throw notFoundError("Plano de automacao preventiva nao encontrado.");
  return automationAsset;
}

export async function removeAssetFromPlan(id, assetId, user) {
  const result = await removeAssetFromPreventiveAutomationPlan(id, assetId, user);
  if (!result) throw notFoundError("Plano de automacao preventiva nao encontrado.");
  return result;
}

export async function prepareManualRun(id, user) {
  const result = await preparePreventiveAutomationPlan(id, user, {
    triggerType: "manual",
    scheduledFor: new Date()
  });
  if (!result) throw notFoundError(notFoundMessage);
  return result;
}

export async function processDuePlans(user) {
  return processDuePreventiveAutomationPlans(user);
}

export function verifyCronSecret(receivedSecret) {
  const expectedSecret = getCronSecret();
  if (!expectedSecret) {
    throw serviceUnavailable("Scheduler preventivo sem segredo configurado.");
  }
  if (!receivedSecret) {
    throw new AppError("Scheduler preventivo não autorizado.", { statusCode: 401 });
  }
  if (!safeEquals(receivedSecret, expectedSecret)) {
    throw new AppError("Scheduler preventivo não autorizado.", { statusCode: 403 });
  }
}

export async function runScheduledMaintenanceCron(receivedSecret) {
  verifyCronSecret(receivedSecret);

  const startedAt = new Date();
  const result = await processScheduledMaintenanceTasks({ id: null, name: "Scheduler preventivo" });
  const finishedAt = new Date();

  return {
    success: true,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    preventivePlans: result.preventiveAutomation,
    scriptValidations: result.scriptValidations,
    serviceOrderAutoPriority: result.serviceOrderAutoPriority,
    serviceOrderSlaBreaches: result.serviceOrderSlaBreaches,
    errors: [
      ...(result.backfill?.plans || [])
        .filter((plan) => plan.status === "failed")
        .map((plan) => ({ scope: "backfill", planId: plan.planId, message: plan.message })),
      ...(result.preventiveAutomation?.plans || [])
        .filter((plan) => plan.status === "failed")
        .map((plan) => ({ scope: "preventiveAutomation", planId: plan.planId, message: plan.message })),
      ...(result.scriptValidations?.failedValidations || [])
        .map((validation) => ({ scope: "scriptValidations", validationId: validation.validationId, message: validation.message }))
    ],
    durationMs: finishedAt.getTime() - startedAt.getTime()
  };
}
