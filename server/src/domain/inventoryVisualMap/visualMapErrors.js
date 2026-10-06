/** @import { HttpErrorLike } from "../../lib/errors.js" */

/**
 * @param {string} message
 * @param {number} [statusCode]
 * @returns {HttpErrorLike}
 */
export function makeHttpError(message, statusCode = 400) {
  /** @type {HttpErrorLike} */
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}
