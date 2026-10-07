/** @param {string | number | Date | null | undefined} value */
export function formatDate(value) {
  if (!value) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

/** @param {string} [name] */
export function normalizeMaintenanceName(name = "") {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/** @param {string} [name] */
export function isMaintenanceSegmentName(name = "") {
  return normalizeMaintenanceName(name) === "manutencao";
}

/** @param {string} [name] */
export function formatSegmentName(name = "") {
  const normalized = normalizeMaintenanceName(name);
  if (normalized === "nao organizadas" || normalized === "sem segmento") return "Não organizadas";
  if (normalized === "manutencao") return "Manutenção";
  return String(name || "Não organizadas").trim();
}
