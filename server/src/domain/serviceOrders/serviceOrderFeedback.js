import { makeHttpError } from "./serviceOrderErrors.js";

/**
 * Nota de avaliacao: inteiro de 1 a 5 (funcao pura; lanca erro HTTP 400).
 *
 * @param {unknown} rating
 * @returns {number}
 */
export function normalizeFeedbackRating(rating) {
  const normalizedRating = Math.trunc(Number(rating));
  if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw makeHttpError("A avaliação deve ser uma nota de 1 a 5.");
  }
  return normalizedRating;
}
