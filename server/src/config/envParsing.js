// Leitura tipada de variaveis de ambiente (funcoes puras, sem tocar em process.env).

/** @typedef {NodeJS.ProcessEnv} Env */

/**
 * @param {unknown} value
 * @returns {boolean} `true` para "1", "true", "yes" ou "sim" (sem diferenciar caixa).
 */
export function isTruthyEnv(value) {
  return ["1", "true", "yes", "sim"].includes(String(value || "").trim().toLowerCase());
}

/**
 * @param {unknown} value
 * @param {boolean} defaultValue Usado quando a variavel esta ausente ou vazia.
 * @returns {boolean}
 */
export function isTruthyEnvWithDefault(value, defaultValue) {
  if (value === undefined || value === null || String(value).trim() === "") return defaultValue;
  return isTruthyEnv(value);
}

/**
 * @param {unknown} value
 * @param {number} fallback Devolvido quando `value` nao e um numero finito.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

/**
 * @param {unknown} value Lista separada por virgula.
 * @param {{ maxEntries?: number, maxLength?: number, schemes: readonly string[] }} options
 * @returns {string[]}
 */
export function parseIceUrls(value, { maxEntries = 4, maxLength = 200, schemes }) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => entry.length <= maxLength)
    .filter((entry) => schemes.some((scheme) => entry.toLowerCase().startsWith(scheme)))
    .slice(0, maxEntries);
}
