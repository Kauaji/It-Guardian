/** @import { NextFunction, Request, Response } from "express" */
import { logger } from "../lib/logger.js";
import { rateLimitStoreErrors, rateLimited } from "../lib/metrics.js";
import { getSharedRedisClient } from "../lib/redisClient.js";

const RATE_LIMIT_KEY_PREFIX = "ratelimit:";

/** @typedef {{ count: number, resetAt: number }} LimiterHit Contagem na janela atual e quando ela zera (ms). */
/**
 * @typedef {object} LimiterStore
 * @property {string} name
 * @property {(key: string, windowMs: number) => Promise<LimiterHit>} increment
 */

/**
 * Store em memoria do processo: unico backend viavel sem Redis configurado
 * (dev local, testes). Nao funciona corretamente em multiplas instancias
 * serverless -- cada instancia tem seu proprio Map e um cold start zera o
 * estado, entao o limite so e confiavel com o store Redis abaixo.
 */
/** @returns {LimiterStore} */
function createMemoryLimiterStore() {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const buckets = new Map();
  return {
    name: "memory",
    async increment(key, windowMs) {
      const now = Date.now();
      if (buckets.size > 500) {
        for (const [bucketKey, bucket] of buckets) {
          if (bucket.resetAt <= now) buckets.delete(bucketKey);
        }
      }
      const current = buckets.get(key);
      const bucket = !current || current.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : current;
      bucket.count += 1;
      buckets.set(key, bucket);
      return { count: bucket.count, resetAt: bucket.resetAt };
    }
  };
}

/**
 * Store Redis (Upstash): compartilhado entre instancias serverless, ao
 * contrario do Map em memoria. Janela fixa por SET NX EX (garante o TTL no
 * mesmo comando que cria a chave, evitando o caso em que um crash entre um
 * INCR e um EXPIRE separados deixaria a chave presa sem expirar nunca).
 * Resta uma janela de corrida infinitesimal se a chave expirar exatamente
 * entre o SET NX falho e o INCR seguinte -- nesse caso raríssimo o INCR cria
 * a chave de novo sem TTL; aceitavel frente ao ganho de robustez do resto.
 */
/**
 * @param {NonNullable<ReturnType<typeof getSharedRedisClient>>} redisClient
 * @param {string} limiterName
 * @returns {LimiterStore}
 */
function createRedisLimiterStore(redisClient, limiterName) {
  return {
    name: "redis",
    async increment(key, windowMs) {
      const redisKey = `${RATE_LIMIT_KEY_PREFIX}${limiterName}:${key}`;
      const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
      const created = await redisClient.set(redisKey, 1, { nx: true, ex: windowSeconds });
      if (created) {
        return { count: 1, resetAt: Date.now() + windowSeconds * 1000 };
      }
      const count = await redisClient.incr(redisKey);
      const ttlSeconds = await redisClient.ttl(redisKey);
      return { count, resetAt: Date.now() + Math.max(0, ttlSeconds) * 1000 };
    }
  };
}

let limiterInstanceCounter = 0;

/**
 * @param {string | undefined} value
 * @param {number} fallback
 */
function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : fallback;
}

/**
 * @typedef {object} RateLimiterOptions
 * @property {number} [windowMs] Janela fixa em ms (padrao 15 min).
 * @property {number} [max] Requisicoes permitidas por janela (padrao 10).
 * @property {(req: Request) => string | undefined} [keyGenerator] Chave de contagem (padrao: IP).
 * @property {string} [message] Mensagem do 429.
 * @property {string} [name] Nome nas metricas e na chave Redis.
 */

/**
 * Cria um middleware de limite de taxa (Redis quando configurado, senao memoria).
 * Falhas do store liberam a requisicao em vez de derrubar a rota.
 *
 * @param {RateLimiterOptions} [options]
 * @returns {(req: Request, res: Response, next: NextFunction) => Promise<void | Response>}
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 10,
  keyGenerator = (req) => req.ip,
  message = "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  name
} = {}) {
  limiterInstanceCounter += 1;
  const limiterName = name || `limiter-${limiterInstanceCounter}`;
  const redisClient = getSharedRedisClient();
  const store = redisClient
    ? createRedisLimiterStore(redisClient, limiterName)
    : createMemoryLimiterStore();

  return async (req, res, next) => {
    const key = String(keyGenerator(req) || req.ip || "unknown").toLowerCase();
    /** @type {LimiterHit} */
    let result;
    try {
      result = await store.increment(key, windowMs);
    } catch (error) {
      // Uma falha do Redis nunca deve derrubar a rota que ele protege --
      // registra e deixa passar, em vez de transformar uma instabilidade do
      // store num 500 para todo mundo.
      rateLimitStoreErrors.inc({ limiter: limiterName, store: store.name });
      logger.warn("rate_limit_store_error", { limiter: limiterName, store: store.name, message: error instanceof Error ? error.message : String(error) });
      return next();
    }

    const { count, resetAt } = result;
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - count));
    res.setHeader("RateLimit-Reset", Math.ceil(resetAt / 1000));

    if (count > max) {
      rateLimited.inc({ limiter: limiterName });
      res.setHeader("Retry-After", Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
      return res.status(429).json({ message });
    }

    return next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: positiveInteger(process.env.AUTH_RATE_LIMIT_MAX, 12),
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || "").trim().toLowerCase()}`,
  name: "auth"
});
