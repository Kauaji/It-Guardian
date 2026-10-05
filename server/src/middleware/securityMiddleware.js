/** @import { NextFunction, Request, Response } from "express" */
import { createHash, timingSafeEqual } from "node:crypto";
import { readSessionCookie } from "../security/sessionCookie.js";
import { createRateLimiter } from "./rateLimitMiddleware.js";

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DEPTH = 12;

/**
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {boolean}
 */
function hasDangerousKey(value, depth = 0) {
  if (value === null || typeof value !== "object") return false;
  if (depth > MAX_DEPTH) return true;
  if (Array.isArray(value)) return value.some((item) => hasDangerousKey(item, depth + 1));
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) return true;
    if (hasDangerousKey(/** @type {Record<string, unknown>} */ (value)[key], depth + 1)) return true;
  }
  return false;
}

/**
 * Recusa corpos JSON com chaves de poluicao de prototipo (`__proto__`,
 * `constructor`, `prototype`) ou aninhamento absurdo. Nenhum endpoint legitimo
 * usa esses nomes como campo.
 */
/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export function rejectDangerousInput(req, res, next) {
  if (hasDangerousKey(req.body) || hasDangerousKey(req.query)) {
    return res.status(400).json({
      message: "Requisição inválida.",
      code: "INVALID_INPUT",
      statusCode: 400,
      requestId: req.requestId
    });
  }
  return next();
}

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * @param {string} name Variavel de ambiente.
 * @param {number} fallback
 */
function limitFromEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 1_000_000) : fallback;
}

/**
 * @param {Request} req
 * @returns {string} Token Bearer, cookie de sessao ou "".
 */
function credentialOf(req) {
  const bearer = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ""));
  return bearer?.[1]?.trim() || readSessionCookie(req);
}

// Quem apresenta credencial e contado por credencial (hash), nao por IP: um
// escritorio inteiro atras do mesmo NAT nao pode esgotar o limite de todos.
// Sem credencial, o limite e por IP e bem mais baixo.
const limiters = {
  userRead: createRateLimiter({
    windowMs: 60 * 1000,
    max: limitFromEnv("API_RATE_LIMIT_PER_MINUTE", 1500),
    keyGenerator: (req) => `u:${createHash("sha256").update(credentialOf(req)).digest("hex").slice(0, 24)}:read`,
    message: "Muitas requisições em pouco tempo. Aguarde um instante.",
    name: "api-user-read"
  }),
  userWrite: createRateLimiter({
    windowMs: 60 * 1000,
    max: limitFromEnv("API_MUTATION_RATE_LIMIT_PER_MINUTE", 400),
    keyGenerator: (req) => `u:${createHash("sha256").update(credentialOf(req)).digest("hex").slice(0, 24)}:write`,
    message: "Muitas alterações em pouco tempo. Aguarde um instante.",
    name: "api-user-write"
  }),
  anonymousRead: createRateLimiter({
    windowMs: 60 * 1000,
    max: limitFromEnv("API_ANONYMOUS_RATE_LIMIT_PER_MINUTE", 300),
    keyGenerator: (req) => `ip:${req.ip}:read`,
    message: "Muitas requisições em pouco tempo. Aguarde um instante.",
    name: "api-anonymous-read"
  }),
  anonymousWrite: createRateLimiter({
    windowMs: 60 * 1000,
    max: limitFromEnv("API_ANONYMOUS_MUTATION_RATE_LIMIT_PER_MINUTE", 60),
    keyGenerator: (req) => `ip:${req.ip}:write`,
    message: "Muitas requisições em pouco tempo. Aguarde um instante.",
    name: "api-anonymous-write"
  })
};

/**
 * Limite geral da API, alem dos limites proprios de login, agente, publico
 * etc. Agentes e health checks ficam de fora: tem protecao propria e volume
 * previsivel.
 */
/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export function globalApiRateLimit(req, res, next) {
  const path = req.path || "";
  if (path.startsWith("/agents") || path.startsWith("/health")) return next();
  const authenticated = Boolean(credentialOf(req));
  const write = unsafeMethods.has(req.method);
  const limiter = authenticated
    ? write ? limiters.userWrite : limiters.userRead
    : write ? limiters.anonymousWrite : limiters.anonymousRead;
  return limiter(req, res, next);
}

/**
 * Comparacao em tempo constante.
 *
 * @param {unknown} a
 * @param {unknown} b
 */
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Protege rotas operacionais (/metrics) por token Bearer fixo; sem METRICS_TOKEN a rota nao existe. */
/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export function requireMetricsToken(req, res, next) {
  const expected = process.env.METRICS_TOKEN;
  if (!expected) return res.status(404).json({ message: "Rota não encontrada.", statusCode: 404 });
  const match = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ""));
  if (!match || !safeEqual(match[1].trim(), expected)) {
    res.setHeader("WWW-Authenticate", "Bearer");
    return res.status(401).json({ message: "Não autorizado.", statusCode: 401 });
  }
  return next();
}
