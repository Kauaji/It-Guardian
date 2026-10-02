import { trimString, normalizeBoolean } from "../lib/textUtils.js";
import { badRequest, conflict } from "../lib/errors.js";
import {
  normalizePreferredTime,
  normalizeRecurrenceIntervalDays,
  normalizeRecurrenceType,
  normalizeTimezone
} from "./preventiveSchedule.js";
import {
  buildOverrideTargetKey,
  normalizeAssetIds,
  normalizeIndicatorColor,
  normalizeScopeType,
  normalizeScriptIds
} from "./preventiveAutomationNormalizers.js";

/**
 * Validacao e normalizacao dos payloads de plano de automacao preventiva e de
 * recorrencia personalizada (override). Sem acesso a banco.
 */

export function normalizeOverridePayload(item = {}) {
  const assetId = trimString(item.assetId, 120) || null;
  const segmentId = trimString(item.segmentId, 120) || null;
  const recurrenceType = normalizeRecurrenceType(item.recurrenceType);

  if (!assetId && !segmentId) return null;
  if (assetId && segmentId) {
    throw badRequest("Informe apenas uma máquina ou um segmento para a recorrência personalizada.");
  }

  const recurrenceIntervalDays = normalizeRecurrenceIntervalDays(
    item.recurrenceIntervalDays ?? item.recurrenceInterval,
    recurrenceType,
    { strict: recurrenceType === "custom_days" }
  );

  // Os dois nomes ficam presentes: o plano lido do banco tem `recurrenceIntervalDays`
  // e, ao mesclar com o override, ele precisa ser sobrescrito pelo valor do override.
  return {
    assetId,
    segmentId,
    targetKey: buildOverrideTargetKey({ assetId, segmentId }),
    recurrenceType,
    recurrenceInterval: recurrenceIntervalDays,
    recurrenceIntervalDays,
    preferredTime: item.preferredTime ? normalizePreferredTime(item.preferredTime) : null,
    active: normalizeBoolean(item.active, true)
  };
}

function normalizeAssetListPayload(value) {
  if (!Array.isArray(value)) {
    throw badRequest("assetIds deve ser uma lista de maquinas para o escopo asset_list.");
  }

  const ids = normalizeAssetIds(value);
  if (!ids.length) {
    throw badRequest("Selecione pelo menos uma maquina para automatizar a preventiva.");
  }

  return ids;
}

function normalizeNonAssetListPayload(value, hasIncomingValue) {
  if (!hasIncomingValue || value == null) return [];
  if (!Array.isArray(value)) {
    throw badRequest("assetIds so pode ser usado com o escopo asset_list.");
  }

  const ids = normalizeAssetIds(value);
  if (ids.length) {
    throw badRequest("assetIds so pode ser usado com o escopo asset_list.");
  }

  return [];
}

function normalizeScopeSelection(payload, current, scopeType) {
  const rawAssetIds = payload.assetIds ?? payload.asset_ids;
  const hasIncomingAssetIds = rawAssetIds !== undefined;
  const assetIds = scopeType === "asset_list"
    ? normalizeAssetListPayload(hasIncomingAssetIds ? rawAssetIds : current?.assetIds)
    : normalizeNonAssetListPayload(rawAssetIds, hasIncomingAssetIds);
  const scopeId = scopeType === "all" || scopeType === "asset_list"
    ? null
    : trimString(payload.scopeId ?? current?.scopeId, 120) || null;

  return { assetIds, scopeId };
}

export function normalizePlanPayload(payload = {}, current = null) {
  const name = trimString(payload.name ?? current?.name, 120);
  const recurrenceType = normalizeRecurrenceType(payload.recurrenceType ?? current?.recurrenceType);
  const scopeType = normalizeScopeType(payload.scopeType ?? current?.scopeType);
  const { assetIds, scopeId } = normalizeScopeSelection(payload, current, scopeType);
  const defaultScriptIds = normalizeScriptIds(payload.defaultScriptIds ?? current?.defaultScriptIds);
  const excludedAssetIds = normalizeAssetIds(payload.excludedAssetIds ?? current?.excludedAssetIds);

  if (name.length < 3) {
    throw badRequest("Informe um nome para a automação preventiva com pelo menos 3 caracteres.");
  }

  if (scopeType !== "all" && scopeType !== "asset_list" && !scopeId) {
    throw badRequest("Informe o escopo da automação preventiva.");
  }

  return {
    preventivePlanId: trimString(payload.preventivePlanId ?? payload.preventive_plan_id ?? current?.preventivePlanId, 120) || null,
    name,
    description: trimString(payload.description ?? current?.description, 1000),
    active: normalizeBoolean(payload.active, current ? current.active : true),
    recurrenceType,
    recurrenceInterval: normalizeRecurrenceIntervalDays(
      payload.recurrenceIntervalDays ?? payload.recurrenceInterval ?? current?.recurrenceIntervalDays ?? current?.recurrenceInterval,
      recurrenceType,
      { strict: recurrenceType === "custom_days" }
    ),
    preferredTime: normalizePreferredTime(payload.preferredTime ?? current?.preferredTime),
    timezone: normalizeTimezone(payload.timezone ?? current?.timezone),
    scopeType,
    scopeId,
    assetIds,
    excludedAssetIds,
    defaultScriptIds,
    notes: trimString(payload.notes ?? current?.notes, 1000),
    indicatorColor: normalizeIndicatorColor(payload.indicatorColor ?? current?.indicatorColor),
    overrides: Array.isArray(payload.overrides)
      ? payload.overrides.map(normalizeOverridePayload).filter(Boolean)
      : undefined
  };
}

export function assertUniqueOverrides(overrides = []) {
  const seen = new Set();

  for (const override of overrides) {
    const targetKey = override.targetKey || buildOverrideTargetKey(override);
    if (!targetKey) continue;

    if (seen.has(targetKey)) {
      throw conflict(
        targetKey.startsWith("asset:")
          ? "Esta máquina já possui recorrência personalizada neste plano."
          : "Este segmento já possui recorrência personalizada neste plano.",
        { code: "DUPLICATE_PREVENTIVE_AUTOMATION_OVERRIDE" }
      );
    }
    seen.add(targetKey);
  }
}
