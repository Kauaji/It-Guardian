export function formatDate(value) {
  if (!value) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function normalizeMaintenanceName(name = "") {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export function isMaintenanceSegmentName(name = "") {
  return normalizeMaintenanceName(name) === "manutencao";
}
