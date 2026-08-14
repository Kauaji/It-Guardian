import { getSharedRedisClient } from "../lib/redisClient.js";

const RATE_LIMIT_KEY_PREFIX = "ratelimit:";

/**
 * Store em memoria do processo: unico backend viavel sem Redis configurado
 * (dev local, testes). Nao funciona corretamente em multiplas instancias
 * serverless -- cada instancia tem seu proprio Map e um cold start zera o
 * estado, entao o limite so e confiavel com o store Redis abaixo.
 */
function createMemoryLimiterStore() {
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
    let result;
    try {
      result = await store.increment(key, windowMs);
    } catch (error) {
      // Uma falha do Redis nunca deve derrubar a rota que ele protege --
      // registra e deixa passar, em vez de transformar uma instabilidade do
      // store num 500 para todo mundo.
      console.error(`[rateLimit:${limiterName}] falha ao consultar o store (${store.name}), permitindo a requisicao:`, error.message);
      return next();
    }

    const { count, resetAt } = result;
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - count));
    res.setHeader("RateLimit-Reset", Math.ceil(resetAt / 1000));

    if (count > max) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
      return res.status(429).json({ message });
    }

    return next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || "").trim().toLowerCase()}`,
  name: "auth"
});
