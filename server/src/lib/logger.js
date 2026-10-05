import { AsyncLocalStorage } from "node:async_hooks";

/** @typedef {"debug" | "info" | "warn" | "error"} LogLevel */
/** @typedef {Record<string, unknown>} LogFields */

/** @type {Record<string, number>} */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const SENSITIVE_KEY = /^(authorization|cookie|set-cookie|password|senha|token|secret|mfa_?token|recovery_?code|agent_?token|session_?token|viewer_?token|api_?key|dsn)$|(password|secret|token)$/i;
const MAX_DEPTH = 4;

/** @type {AsyncLocalStorage<{ requestId: string }>} */
const context = new AsyncLocalStorage();

function configuredLevel() {
  const level = String(process.env.LOG_LEVEL || (process.env.NODE_ENV === "test" ? "warn" : "info")).toLowerCase();
  return LEVELS[level] ?? LEVELS.info;
}

/**
 * Remove dos logs o que nao pode aparecer: segredos por nome de campo e
 * identificadores-credencial dentro de caminhos (ex.: token de acompanhamento
 * publico), alem da query string.
 *
 * @param {unknown} rawPath
 * @returns {string}
 */
export function redactPath(rawPath) {
  const withoutQuery = String(rawPath || "").split("?")[0];
  return withoutQuery
    .replace(/(\/track\/)[^/]+/gi, "$1[REDACTED]")
    .replace(/(\/enroll\/)[^/]+/gi, "$1[REDACTED]")
    .replace(/(\/activate\/)[^/]+/gi, "$1[REDACTED]");
}

/**
 * Copia `value` mascarando campos sensiveis; limita profundidade (4) e arrays (50 itens).
 *
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
export function redact(value, depth = 0) {
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (value instanceof Error) {
    const { code } = /** @type {Error & { code?: unknown }} */ (value);
    return { name: value.name, message: value.message, code, stack: value.stack };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  /** @type {Record<string, unknown>} */
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(item, depth + 1);
  }
  return output;
}

/**
 * @param {LogLevel} level
 * @param {string} event
 * @param {LogFields} [fields]
 */
function write(level, event, fields = {}) {
  if (LEVELS[level] < configuredLevel()) return;
  const store = context.getStore();
  const entry = {
    level,
    event,
    time: new Date().toISOString(),
    ...(store?.requestId ? { requestId: store.requestId } : {}),
    ...(/** @type {LogFields} */ (redact(fields)))
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  /** @param {string} event @param {LogFields} [fields] */
  debug: (event, fields) => write("debug", event, fields),
  /** @param {string} event @param {LogFields} [fields] */
  info: (event, fields) => write("info", event, fields),
  /** @param {string} event @param {LogFields} [fields] */
  warn: (event, fields) => write("warn", event, fields),
  /** @param {string} event @param {LogFields} [fields] */
  error: (event, fields) => write("error", event, fields),
  /**
   * Executa `fn` associando o requestId a todo log emitido dentro dela.
   *
   * @template T
   * @param {string} requestId
   * @param {() => T} fn
   * @returns {T}
   */
  withRequest: (requestId, fn) => context.run({ requestId }, fn)
};
