export function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode || 500;
  const databaseErrorCodes = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "28P01", "3D000"]);
  const isDatabaseError =
    databaseErrorCodes.has(error.code) ||
    /database|banco de dados|connection|connect|pool/i.test(error.message || "");

  const exposeInternalMessage = process.env.NODE_ENV !== "production" || statusCode < 500;
  const message = statusCode >= 500
    ? isDatabaseError
      ? "Erro ao conectar ao banco de dados."
      : exposeInternalMessage
        ? error.message || "Internal server error"
        : "Erro interno do servidor."
    : error.message || "Request failed";

  const log = statusCode >= 500 ? console.error : console.warn;
  log(JSON.stringify({
    level: statusCode >= 500 ? "error" : "warn",
    event: "request_error",
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code: error.code,
    message: error.message,
    stack: process.env.NODE_ENV === "production" || statusCode < 500 ? undefined : error.stack
  }));

  res.status(statusCode).json({ message, statusCode, requestId: req.requestId });
}
