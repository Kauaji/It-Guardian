/**
 * Helpers de normalizacao reaproveitados por varios repositorios. Extraidos
 * depois que a mesma implementacao apareceu, copiada, em 3-4 arquivos
 * diferentes sem nenhum deles importar do outro.
 */

export function trimString(value, maxLength = 1000, fallback = "") {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : fallback;
}

export function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function serializeTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
