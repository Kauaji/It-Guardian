import { badRequest, conflict, forbidden } from "../lib/errors.js";
import { filterAutomationAssetsByScope } from "../repositories/automationAccessScope.js";
import { findMaintenanceScriptById } from "./maintenanceScripts/maintenanceScriptsFacade.js";
import { groupExists, listSegmentIdsByGroup, segmentExists } from "../repositories/preventiveAutomationScopeRepository.js";
import { normalizeAssetIds, normalizeScriptIds } from "../domain/preventiveAutomationNormalizers.js";
import { resolveAssetListDevices } from "../domain/preventiveAutomationSchedule.js";
import { listDevices } from "./monitoringService.js";

/**
 * Validacao de scripts e resolucao das maquinas de um plano de automacao a
 * partir do escopo (maquina, lista, segmento, grupo ou todas), respeitando o
 * escopo de acesso do usuario quando informado.
 */

const scopeNotFoundMessage = "O escopo selecionado não existe.";

export async function validateScripts(scriptIds, { requireAtLeastOne = true } = {}) {
  const ids = normalizeScriptIds(scriptIds);
  if (requireAtLeastOne && !ids.length) {
    throw badRequest("Selecione pelo menos um script ativo para a rotina preventiva.");
  }

  const scripts = [];
  for (const scriptId of ids) {
    const script = await findMaintenanceScriptById(scriptId);
    if (!script || script.active === false) {
      throw badRequest("Um dos scripts selecionados não existe ou está inativo.");
    }
    scripts.push(script);
  }

  return scripts;
}

async function assertScopeExists(plan, devices) {
  if (plan.scopeType === "asset") {
    if (devices.some((device) => String(device.id) === String(plan.scopeId))) return;
    throw badRequest(scopeNotFoundMessage);
  }

  if (plan.scopeType === "asset_list") {
    resolveAssetListDevices(plan.assetIds, devices);
    return;
  }

  if (plan.scopeType === "segment") {
    if (devices.some((device) => String(device.segmentId) === String(plan.scopeId))) return;
    if (await segmentExists(plan.scopeId)) return;
    throw badRequest(scopeNotFoundMessage);
  }

  if (plan.scopeType === "group") {
    if (await groupExists(plan.scopeId)) return;
    throw badRequest(scopeNotFoundMessage);
  }
}

async function selectScopeDevices(plan, devices) {
  if (plan.scopeType === "asset") {
    return devices.filter((device) => String(device.id) === String(plan.scopeId));
  }
  if (plan.scopeType === "asset_list") {
    return resolveAssetListDevices(plan.assetIds, devices);
  }
  if (plan.scopeType === "segment") {
    return devices.filter((device) => String(device.segmentId) === String(plan.scopeId));
  }
  if (plan.scopeType === "group") {
    const segmentIds = new Set(await listSegmentIdsByGroup(plan.scopeId));
    return devices.filter((device) => segmentIds.has(String(device.segmentId)));
  }
  return devices;
}

/** Maquinas do inventario cobertas pelo escopo do plano, sem as excluidas. */
export async function resolvePlanAssets(plan) {
  const devices = await listDevices({});
  await assertScopeExists(plan, devices);
  const excludedAssetIds = new Set(normalizeAssetIds(plan.excludedAssetIds));
  const resolvedAssets = await selectScopeDevices(plan, devices);

  return resolvedAssets.filter((device) => !excludedAssetIds.has(String(device.id)));
}

/** Maquinas do escopo que o usuario pode automatizar (ou erro 400/403). */
export async function validateScopeSelection(plan, { requireAssets = true, user = null } = {}) {
  const resolvedAssets = await resolvePlanAssets(plan);
  const assets = filterAutomationAssetsByScope(resolvedAssets, user);
  if (resolvedAssets.length && !assets.length) {
    throw forbidden("O escopo selecionado não possui máquinas autorizadas para este usuário.");
  }
  if (requireAssets && !assets.length) {
    throw badRequest("O escopo selecionado não possui máquinas disponíveis para a rotina preventiva.");
  }
  return assets;
}

export async function validatePlanForPreparation(plan) {
  if (plan.active === false) {
    throw conflict("Um plano inativo não pode ser preparado.");
  }

  const scripts = await validateScripts(plan.defaultScriptIds);
  const assets = await validateScopeSelection(plan);

  return { scripts, assets };
}
