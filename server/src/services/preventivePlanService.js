import { notFoundError } from "../lib/errors.js";
import { createPreventivePlan } from "./preventivePlanCreationService.js";
import {
  createServiceOrderFromPreventivePlan,
  preparePreventivePlan
} from "./preventivePlanLifecycleService.js";
import {
  findPreventivePlanById,
  listPreventivePlanLogs,
  listPreventivePlans
} from "./preventivePlanReadService.js";

const notFoundMessage = "Plano preventivo não encontrado.";

export async function listAllPreventivePlans() {
  return listPreventivePlans();
}

export async function createPlan(payload, user) {
  return createPreventivePlan(payload || {}, user);
}

export async function getPreventivePlanDetail(id) {
  const preventivePlan = await findPreventivePlanById(id);
  if (!preventivePlan) throw notFoundError(notFoundMessage);
  return preventivePlan;
}

export async function prepareExistingPlan(id, user) {
  const preventivePlan = await preparePreventivePlan(id, user);
  if (!preventivePlan) throw notFoundError(notFoundMessage);
  return preventivePlan;
}

export async function createServiceOrderFromPlan(id, user) {
  const result = await createServiceOrderFromPreventivePlan(id, user);
  if (!result) throw notFoundError(notFoundMessage);
  return result;
}

export async function getPlanLogs(id) {
  const planLogs = await listPreventivePlanLogs(id);
  if (!planLogs) throw notFoundError(notFoundMessage);
  return planLogs;
}
