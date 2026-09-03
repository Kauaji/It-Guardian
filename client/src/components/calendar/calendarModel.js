export const EVENT_TYPE_META = {
  service_order: { label: "Ordem de Serviço", color: "#2878c8" },
  preventive_maintenance: { label: "Manutenção preventiva", color: "#16866f" },
  technical_visit: { label: "Visita técnica", color: "#7c3aed" },
  internal_task: { label: "Tarefa interna", color: "#64748b" },
  asset_check: { label: "Verificação de ativo", color: "#d99a1a" },
  reminder: { label: "Lembrete", color: "#ea6f20" },
  other: { label: "Outro", color: "#536177" }
};

export const EVENT_STATUS_LABELS = { scheduled: "Agendado", in_progress: "Em andamento", completed: "Concluído", cancelled: "Cancelado", missed: "Não realizado" };
export const PRIORITY_LABELS = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" };
export const PRIORITY_META = {
  low: { label: "Baixa", color: "#64748b", rank: 1 },
  normal: { label: "Normal", color: "#2878c8", rank: 2 },
  high: { label: "Alta", color: "#d97706", rank: 3 },
  urgent: { label: "Urgente", color: "#dc2626", rank: 4 }
};

export function startOfDay(date) { const value = new Date(date); value.setHours(0, 0, 0, 0); return value; }
export function addDays(date, amount) { const value = new Date(date); value.setDate(value.getDate() + amount); return value; }
export function dateKey(date) { return new Date(date).toLocaleDateString("en-CA"); }

export function getCalendarRange(anchor, view) {
  const date = startOfDay(anchor);
  if (view === "day") return { start: date, end: addDays(date, 1) };
  if (view === "week") {
    const start = addDays(date, -date.getDay());
    return { start, end: addDays(start, 7) };
  }
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  return { start: gridStart, end: addDays(gridStart, 42) };
}

export function buildCalendarDays(anchor, view) {
  const { start, end } = getCalendarRange(anchor, view);
  const days = [];
  for (let value = start; value < end; value = addDays(value, 1)) days.push(value);
  return days;
}

export function eventsByDay(events) {
  const grouped = new Map();
  for (const event of events || []) {
    const key = dateKey(event.startAt);
    grouped.set(key, [...(grouped.get(key) || []), event]);
  }
  return grouped;
}

export function toLocalInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
