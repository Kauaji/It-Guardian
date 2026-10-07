import { trimString } from "../../lib/textUtils.js";
import { allowedScriptVariables, maxLengths } from "./scriptVocabulary.js";

/**
 * Normalizacao de listas e textos comparaveis usada pelo cadastro e pela
 * recomendacao de scripts. Modulo puro.
 */

/**
 * @param {unknown} value Array, JSON de array ou texto separado por virgula.
 * @returns {unknown[]}
 */
export function parseArrayValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return trimmed.split(",");
      }
    }
    return trimmed.split(",");
  }
  return [];
}

/**
 * @param {unknown} value
 * @returns {string[]} Itens unicos, aparados e nao vazios.
 */
export function normalizeTextList(value) {
  return [
    ...new Set(
      parseArrayValue(value)
        .map((item) => trimString(item, maxLengths.listItem))
        .filter(Boolean)
    )
  ];
}

/**
 * @param {unknown} [value]
 * @returns {string} Minusculas, sem acentos, so [a-z0-9_ ].
 */
export function normalizeComparableText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .trim();
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeTokenList(value) {
  return parseArrayValue(value)
    .map((item) => normalizeComparableText(item))
    .filter(Boolean);
}

/**
 * @param {unknown} value
 * @returns {string[]} Variaveis permitidas (`{{NOME}}` vira `NOME`).
 */
export function normalizeVariableList(value) {
  return [
    ...new Set(
      parseArrayValue(value)
        .map((item) => trimString(item, maxLengths.listItem).replace(/[{}]/g, "").toUpperCase())
        .filter((item) => allowedScriptVariables.has(item))
    )
  ];
}
