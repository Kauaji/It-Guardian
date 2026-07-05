import { randomUUID } from "node:crypto";

const sensitiveKeys = new Set(["authorization", "cookie", "password", "token", "secret"]);

function redact(value) {
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKeys.has(key.toLowerCase()) ? "[REDACTED]" : item
    ])
  );
}

export function requestContext(req, res, next) {
  const requestId = req.get("x-request-id")?.trim() || randomUUID();
  const startedAt = performance.now();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const entry = {
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      event: "http_request",
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      ip: req.ip,
      query: redact(req.query)
    };

    console.log(JSON.stringify(entry));
  });

  next();
}
