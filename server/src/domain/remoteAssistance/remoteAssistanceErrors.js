/** @import { HttpErrorLike } from "../../lib/errors.js" */

/**
 * @param {string} message
 * @param {number} [statusCode]
 * @returns {HttpErrorLike}
 */
export function publicError(message, statusCode = 400) {
  /** @type {HttpErrorLike} */
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}
