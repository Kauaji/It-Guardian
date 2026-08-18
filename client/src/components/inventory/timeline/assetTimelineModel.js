export const CATEGORY_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "service_order", label: "OS" },
  { value: "alert", label: "Alertas" },
  { value: "maintenance", label: "Manutenção" },
  { value: "preventive", label: "Preventivas" },
  { value: "remote_assistance", label: "Assistência remota" },
  { value: "hardware", label: "Hardware" },
  { value: "segment", label: "Segmento" },
  { value: "observation", label: "Observações" },
  { value: "topology", label: "Mapa de Rede" },
  { value: "part", label: "Peças" },
  { value: "asset", label: "Ativo" },
  { value: "system", label: "Sistema" }
];

export const PERIOD_OPTIONS = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "1y", label: "1 ano" },
  { value: "all", label: "Tudo" }
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS.map((option) => [option.value, option.label]));

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || "Sistema";
}

export const SEVERITY_TOKENS = {
  info: "info",
  success: "success",
  warning: "warning",
  critical: "critical",
  neutral: "neutral"
};

export function severityToken(severity) {
  return SEVERITY_TOKENS[severity] || SEVERITY_TOKENS.neutral;
}

export function matchesTimelineSearch(event, queryText) {
  const normalizedQuery = String(queryText || "").trim().toLowerCase();
  if (!normalizedQuery) return true;
  const haystack = [event.title, event.description, event.actorName, event.type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalizedQuery);
}

export function filterTimelineEvents(events, { category = "all", queryText = "" } = {}) {
  return events.filter((event) => {
    if (category !== "all" && event.category !== category) return false;
    return matchesTimelineSearch(event, queryText);
  });
}

function dayKey(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
}

export function groupTimelineEventsByDay(events) {
  const groups = [];
  const groupsByKey = new Map();

  for (const event of events) {
    const key = dayKey(event.occurredAt);
    let group = groupsByKey.get(key);
    if (!group) {
      group = { key, date: event.occurredAt, events: [] };
      groupsByKey.set(key, group);
      groups.push(group);
    }
    group.events.push(event);
  }

  return groups;
}

// As observacoes do ativo nao vivem numa tabela por ativo no backend (sao
// preferencia do usuario logado, sincronizadas via saveUserPreference) -
// entram na timeline fundidas no cliente, nao via API.
export function mergeObservationsIntoEvents(events, observations = []) {
  const observationEvents = observations.map((note) => ({
    id: `observation-${note.id}`,
    assetId: null,
    occurredAt: note.createdAt,
    category: "observation",
    type: "observation_added",
    title: "Observação registrada",
    description: note.text,
    severity: "neutral",
    sourceModule: "observations",
    actorName: note.user || null,
    relatedEntityType: null,
    relatedEntityId: null,
    metadata: {}
  }));

  return [...events, ...observationEvents].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}
