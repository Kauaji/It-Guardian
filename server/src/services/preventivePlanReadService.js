import { summarizeAutomation } from "../domain/preventivePlanPayload.js";
import { findPlanById, hydratePlan, listPlans } from "../repositories/preventivePlanRepository.js";
import { findPreventiveAutomationPlanByPreventivePlanId } from "./preventiveAutomationPlanQueryService.js";

/** Leitura de planos preventivos com scripts, maquinas e resumo da automacao vinculada. */

async function attachAutomation(plan) {
  if (!plan) return null;
  const automation = await findPreventiveAutomationPlanByPreventivePlanId(plan.id);
  return {
    ...plan,
    automation: summarizeAutomation(automation)
  };
}

export async function listPreventivePlans() {
  const plans = await Promise.all((await listPlans()).map((plan) => hydratePlan(plan)));
  return Promise.all(plans.map((plan) => attachAutomation(plan)));
}

export async function findPreventivePlanById(id) {
  return attachAutomation(await hydratePlan(await findPlanById(id)));
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
