/**
 * Gera ids unicos com prefixo (ex.: "object-<uuid>"). Usa `crypto.randomUUID`
 * quando disponivel e cai para data + aleatorio em ambientes sem ele.
 */
export function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
