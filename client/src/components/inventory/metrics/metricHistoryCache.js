const cache = new Map();
const TTL_MS = 20_000;

export function cacheKey(deviceId, metric, period) {
  return `${deviceId}:${metric}:${period}`;
}

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

export function clearMetricHistoryCache() {
  cache.clear();
}
