import { AppError } from "../lib/errors.js";
import { reportError } from "../lib/errorReporter.js";
import { logger, redactPath } from "../lib/logger.js";
import { appErrors } from "../lib/metrics.js";

export function notFound(req, res, next) {
  const error = new AppError("Rota não encontrada.", { statusCode: 404, code: "NOT_FOUND" });
  next(error);
}

const databaseErrorCodes = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "28P01", "3D000"]);

function isDatabaseError(error) {
  return (
    error.code !== "EXTERNAL_INTEGRATION_UNAVAILABLE" &&
    (databaseErrorCodes.has(error.code) ||
      /database|banco de dados|connection|connect|pool/i.test(error.message || ""))
  );
}

/** Mensagem que pode sair para o cliente: 4xx sempre; 5xx so se o erro for marcado como exposto. */
function publicMessage(error, statusCode) {
  if (statusCode < 500) return error.message || "A requisição falhou.";
  if (error.expose) return error.message;
  if (isDatabaseError(error)) return "Erro ao conectar ao banco de dados.";
  return process.env.NODE_ENV !== "production" ? error.message || "Erro interno do servidor." : "Erro interno do servidor.";
}

/**
 * `code` (estavel, para o cliente decidir o que fazer) so sai para erros
 * conhecidos da aplicacao -- nunca codigos de driver/rede ("23505",
 * "ECONNREFUSED"), que vazariam detalhes de infraestrutura.
 */
function publicCode(error) {
  const known = error instanceof AppError || error.expose === true;
  return known && typeof error.code === "string" && /^[A-Z][A-Z0-9_]{2,60}$/.test(error.code) ? error.code : undefined;
}

export function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode || 500;
  logger[statusCode >= 500 ? "error" : "warn"]("request_error", {
    requestId: req.requestId,
    method: req.method,
    path: redactPath(req.originalUrl),
    statusCode,
    code: error.code,
    message: error.message,
    stack: process.env.NODE_ENV === "production" || statusCode < 500 ? undefined : error.stack
  });
  appErrors.inc({ class: `${Math.floor(statusCode / 100)}xx` });
  if (statusCode >= 500) {
    reportError(error, { requestId: req.requestId, method: req.method, path: req.originalUrl });
  }

  const body = {
    message: publicMessage(error, statusCode),
    statusCode,
    requestId: req.requestId
  };
  const code = publicCode(error);
  if (code) body.code = code;
  if (code && Array.isArray(error.details) && statusCode < 500) body.details = error.details;
  res.status(statusCode).json(body);
}
