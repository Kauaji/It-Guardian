export function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;
  const databaseErrorCodes = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "28P01", "3D000"]);
  const isDatabaseError =
    databaseErrorCodes.has(error.code) ||
    /database|banco de dados|connection|connect|pool/i.test(error.message || "");

  const message =
    statusCode >= 500 && isDatabaseError
      ? error.message?.includes("DATABASE_URL")
        ? error.message
        : "Erro ao conectar ao banco de dados."
      : error.message || "Internal server error";

  res.status(statusCode).json({ message, statusCode });
}
