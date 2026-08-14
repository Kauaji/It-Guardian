import { Redis } from "@upstash/redis";

/**
 * Deteccao e cliente Redis compartilhados entre qualquer feature do backend
 * que precise de estado entre instancias serverless (relay da assistencia
 * remota, rate limiting). Um unico cliente por processo evita abrir uma
 * conexao REST por feature.
 */
export function detectRedisConfig(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

let sharedClient = null;
let sharedClientUrl = null;

export function getSharedRedisClient(env = process.env) {
  const config = detectRedisConfig(env);
  if (!config) return null;
  if (!sharedClient || sharedClientUrl !== config.url) {
    sharedClient = new Redis({ url: config.url, token: config.token });
    sharedClientUrl = config.url;
  }
  return sharedClient;
}
