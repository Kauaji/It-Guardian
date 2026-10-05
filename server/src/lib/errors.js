/**
 * @typedef {object} AppErrorOptions
 * @property {number} [statusCode] Status HTTP (padrao 500).
 * @property {string | null} [code] Codigo de maquina estavel para o cliente.
 * @property {boolean} [expose] Quando false, a mensagem nao e devolvida ao cliente.
 */

/**
 * Forma de qualquer erro tratado pelo middleware de erros: `Error` com campos opcionais
 * que a aplicacao (ou drivers como pg) anexam.
 * @typedef {Error & { statusCode?: number, code?: string, expose?: boolean, details?: unknown[] }} HttpErrorLike
 */

export class AppError extends Error {
  /**
   * @param {string} message
   * @param {AppErrorOptions} [options]
   */
  constructor(message, { statusCode = 500, code = null, expose = true } = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.expose = expose;
    if (code) this.code = code;
  }
}

/**
 * @param {string} message
 * @param {AppErrorOptions} [options]
 */
export function badRequest(message, options = {}) {
  return new AppError(message, { statusCode: 400, ...options });
}

/**
 * @param {string} message
 * @param {AppErrorOptions} [options]
 */
export function forbidden(message, options = {}) {
  return new AppError(message, { statusCode: 403, ...options });
}

/**
 * @param {string} message
 * @param {AppErrorOptions} [options]
 */
export function notFoundError(message, options = {}) {
  return new AppError(message, { statusCode: 404, ...options });
}

/**
 * @param {string} message
 * @param {AppErrorOptions} [options]
 */
export function conflict(message, options = {}) {
  return new AppError(message, { statusCode: 409, ...options });
}

/**
 * @param {string} message
 * @param {AppErrorOptions} [options]
 */
export function serviceUnavailable(message, options = {}) {
  return new AppError(message, { statusCode: 503, ...options });
}

/**
 * @param {string} message
 * @param {AppErrorOptions} [options]
 */
export function unauthorized(message, options = {}) {
  return new AppError(message, { statusCode: 401, ...options });
}

/**
 * @param {string} message
 * @param {AppErrorOptions} [options]
 */
export function tooManyRequests(message, options = {}) {
  return new AppError(message, { statusCode: 429, ...options });
}
