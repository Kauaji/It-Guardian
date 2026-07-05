const buckets = new Map();

function cleanupExpiredBuckets(now) {
  if (buckets.size < 500) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 10,
  keyGenerator = (req) => req.ip,
  message = "Muitas tentativas. Aguarde alguns minutos e tente novamente."
} = {}) {
  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredBuckets(now);

    const key = String(keyGenerator(req) || req.ip || "unknown").toLowerCase();
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - bucket.count));
    res.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > max) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ message });
    }

    return next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || "").trim().toLowerCase()}`
});
