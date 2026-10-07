const PLAN_STATUS_LABELS = {
  draft: "Rascunho",
  active: "Ativa",
  archived: "Arquivada"
};

const ENTITY_KIND_LABELS = {
  object: "Ativo/objeto",
  zone: "Zona",
  point: "Ponto"
};

export function planStatusLabel(status) {
  return PLAN_STATUS_LABELS[status] || status || "Rascunho";
}

export function formatDate(value) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function deviceLabel(device) {
  return device?.displayName || device?.name || device?.label || device?.hostname || device?.id || "Ativo";
}

/** Rotulo do cabecalho do inspetor conforme o tipo de entidade selecionada. */
export function getEntityKindLabel(type) {
  return ENTITY_KIND_LABELS[type] || "Rota";
}

/** Tom visual do indicador de status do ativo vinculado. */
export function getDeviceStatusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("online") || normalized.includes("ativo")) return "online";
  if (normalized.includes("problem") || normalized.includes("erro")) return "warning";
  return normalized ? "offline" : "neutral";
}

/** Tags do ativo: aceita lista ou texto separado por virgulas. */
export function getDeviceTags(device) {
  if (Array.isArray(device?.tags)) return device.tags;
  return String(device?.tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Dica (title) do halo do mapa de calor sobre um objeto. */
export function getHeatmapTitle(mode, heatmap) {
  if (mode === "heatmap-os") {
    return `${heatmap.totalServiceOrders} OS · ${heatmap.openServiceOrders} abertas · ${heatmap.overdueServiceOrders} vencidas`;
  }
  return `${heatmap.status || "Sem agente"} · pontuação ${heatmap.score}`;
}
