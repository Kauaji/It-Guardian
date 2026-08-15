export class AppError extends Error {
  constructor(message, { statusCode = 500, code = null, expose = true } = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.expose = expose;
    if (code) this.code = code;
  }
}

export function badRequest(message, options = {}) {
  return new AppError(message, { statusCode: 400, ...options });
}

export function forbidden(message, options = {}) {
  return new AppError(message, { statusCode: 403, ...options });
}

export function notFoundError(message, options = {}) {
  return new AppError(message, { statusCode: 404, ...options });
}

export function conflict(message, options = {}) {
  return new AppError(message, { statusCode: 409, ...options });
}

export function serviceUnavailable(message, options = {}) {
  return new AppError(message, { statusCode: 503, ...options });
}
