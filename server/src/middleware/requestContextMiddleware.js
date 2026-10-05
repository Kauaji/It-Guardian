/** @import { NextFunction, Request, Response } from "express" */
import { randomUUID } from "node:crypto";
import { httpDuration, httpRequests } from "../lib/metrics.js";
import { logger, redact, redactPath } from "../lib/logger.js";

// O id vem do cliente/proxy: so e aceito se tiver formato seguro (evita
// injecao de linhas/caracteres de controle nos logs).
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** @param {Request} req */
function routeLabel(req) {
  if (!req.route?.path) return "nao_roteada";
  return `${req.baseUrl || ""}${typeof req.route.path === "string" ? req.route.path : "*"}`;
}

/**
 * Atribui `req.requestId`, devolve `x-request-id`, mede a requisicao e registra o log final.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export function requestContext(req, res, next) {
  const provided = req.get("x-request-id")?.trim();
  const requestId = provided && SAFE_REQUEST_ID.test(provided) ? provided : randomUUID();
  const startedAt = performance.now();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const seconds = (performance.now() - startedAt) / 1000;
    const labels = { method: req.method, route: routeLabel(req), status: String(res.statusCode) };
    httpRequests.inc(labels);
    httpDuration.observe({ method: req.method, route: labels.route }, seconds);

    /** @type {"error" | "warn" | "info"} */
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level]("http_request", {
      requestId,
      method: req.method,
      path: redactPath(req.originalUrl),
      statusCode: res.statusCode,
      durationMs: Math.round(seconds * 100000) / 100,
      ip: req.ip,
      query: redact(req.query)
    });
  });

  logger.withRequest(requestId, next);
}
