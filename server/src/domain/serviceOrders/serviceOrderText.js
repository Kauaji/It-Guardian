/**
 * @param {unknown} [value]
 * @returns {string} Texto sem acentos, aparado e em minusculas.
 */
export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * @param {unknown} value Objeto, texto JSON ou vazio.
 * @param {Record<string, unknown>} [fallback]
 * @returns {Record<string, unknown>} O proprio objeto, o JSON analisado ou `fallback`.
 */
export function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return /** @type {Record<string, unknown>} */ (value);
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * @param {unknown} value Lista, texto JSON de lista ou vazio.
 * @returns {string[]} Itens como texto aparado, sem vazios.
 */
export function parseJsonArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}
