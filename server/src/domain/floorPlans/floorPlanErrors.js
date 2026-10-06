/** @import { HttpErrorLike } from "../../lib/errors.js" */

/**
 * @param {number} statusCode
 * @param {string} message
 * @returns {HttpErrorLike}
 */
export function makeHttpError(statusCode, message) {
  /** @type {HttpErrorLike} */
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
