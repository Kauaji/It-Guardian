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

/**
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string} Cor `#rrggbb` em minusculas.
 */
export function normalizeIndicatorColor(value, fallback = DEFAULT_INDICATOR_COLOR) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

/**
 * @param {unknown} value Array, string JSON ou vazio.
 * @returns {unknown[]}
 */
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
/** @param {Date | string | number} [value] @returns {string} ISO com segundos zerados. */
export function normalizeScheduleSlot(value = new Date()) {
  const date = new Date(toValidDate(value));
  date.setSeconds(0, 0);
  return date.toISOString();
}

/**
 * @param {unknown} [value]
 * @returns {string[]} Ids unicos, aparados (120 caracteres) e nao vazios.
 */
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

/**
 * @param {unknown} value
 * @param {string} [fallback]
 */
export function normalizeScopeType(value, fallback = "all") {
  const normalized = String(value || "").trim().toLowerCase();
  return scopeTypes.has(normalized) ? normalized : fallback;
}

/**
 * @param {unknown} value
 * @param {string} [fallback]
 */
export function normalizeRunStatus(value, fallback = "scheduled") {
  const normalized = String(value || "").trim().toLowerCase();
  return runStatuses.has(normalized) ? normalized : fallback;
}

/**
 * @param {unknown} value
 * @param {number} fallback Usado quando nao e inteiro >= 0.
 * @param {number} maximum
 * @returns {number}
 */
export function normalizePagination(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, maximum);
}

/**
 * @param {{ assetId?: string | null, segmentId?: string | null }} [target]
 * @returns {string | null} `asset:<id>`, `segment:<id>` ou null.
 */
export function buildOverrideTargetKey({ assetId = null, segmentId = null } = {}) {
  if (assetId) return `asset:${assetId}`;
  if (segmentId) return `segment:${segmentId}`;
  return null;
}

/** Nome do ator para historico e auditoria (usuario, e-mail ou "Sistema"). */
/** @param {{ name?: string | null, email?: string | null } | null | undefined} user */
export function actorName(user) {
  return user?.name || user?.email || "Sistema";
}
