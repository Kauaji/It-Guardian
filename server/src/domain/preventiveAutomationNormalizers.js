import { trimString } from "../lib/textUtils.js";
import { toValidDate } from "./preventiveSchedule.js";

/**
 * Normalizadores puros compartilhados pelo dominio de automacao preventiva
 * (payloads, mapeadores de linha, repositorios e servicos).
 */

export { toValidDate };

export const DEFAULT_INDICATOR_COLOR = "#1f7a61";

const scopeTypes = new Set(["asset", "asset_list", "segment", "group", "all"]);
const runStatuses = new Set(["scheduled", "prepared", "waiting_agent", "success", "error", "cancelled", "skipped"]);

export function normalizeIndicatorColor(value, fallback = DEFAULT_INDICATOR_COLOR) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

export function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Arredonda para o minuto sem alterar a data recebida. */
export function normalizeScheduleSlot(value = new Date()) {
  const date = new Date(toValidDate(value));
  date.setSeconds(0, 0);
  return date.toISOString();
}

export function normalizeIdList(value = []) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => trimString(item, 120))
        .filter(Boolean)
    )
  ];
}

export const normalizeScriptIds = normalizeIdList;
export const normalizeAssetIds = normalizeIdList;

export function normalizeScopeType(value, fallback = "all") {
  const normalized = String(value || "").trim().toLowerCase();
  return scopeTypes.has(normalized) ? normalized : fallback;
}

export function normalizeRunStatus(value, fallback = "scheduled") {
  const normalized = String(value || "").trim().toLowerCase();
  return runStatuses.has(normalized) ? normalized : fallback;
}

export function normalizePagination(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, maximum);
}

export function buildOverrideTargetKey({ assetId = null, segmentId = null } = {}) {
  if (assetId) return `asset:${assetId}`;
  if (segmentId) return `segment:${segmentId}`;
  return null;
}

/** Nome do ator para historico e auditoria (usuario, e-mail ou "Sistema"). */
export function actorName(user) {
  return user?.name || user?.email || "Sistema";
}
