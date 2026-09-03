import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, RefreshCw, Search, UserRoundCheck } from "lucide-react";
import { cancelCalendarEvent, createCalendarEvent, deleteCalendarEvent, fetchCalendarEvents, fetchCalendarSummary, fetchTechnicians, updateCalendarEvent } from "../../api.js";
import CalendarEventModal from "./CalendarEventModal.jsx";
import { buildCalendarDays, dateKey, EVENT_STATUS_LABELS, EVENT_TYPE_META, eventsByDay, getCalendarRange } from "./calendarModel.js";
import "./technicalCalendar.css";

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatHeader(anchor, view) {
  if (view === "day") return anchor.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (view === "week") { const { start, end } = getCalendarRange(anchor, view); return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${new Date(end.getTime() - 1).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`; }
  return anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function CalendarEvent({ event, onClick }) {
  const meta = EVENT_TYPE_META[event.eventType] || EVENT_TYPE_META.other;
  return <button type="button" className={`calendar-event status-${event.status}`} style={{ "--event-color": meta.color }} onClick={(e) => { e.stopPropagation(); onClick(event); }} title={`${meta.label} · ${event.technicianName || "Sem técnico"}`}><time>{event.allDay ? "Dia" : new Date(event.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time><span>{event.serviceOrderNumber ? `${event.serviceOrderNumber} · ` : ""}{event.title}</span></button>;
}

export default function TechnicalCalendarPage({ token, notify, serviceOrders = [], devices = [], segments = [], groups = [], permissions = {}, focusServiceOrder, onFocusHandled }) {
  const [view, setView] = useState("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({});
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [filters, setFilters] = useState({ technicianId: "", eventType: "", status: "", priority: "", groupId: "", segmentId: "", serviceOrderId: "", search: "" });
  const range = useMemo(() => getCalendarRange(anchor, view), [anchor, view]);
  const filterSegments = filters.groupId
    ? segments.filter((segment) => !segment.groupId || segment.groupId === filters.groupId)
    : segments;

  const load = useCallback(async () => {
    setLoading(true);
    const params = { startDate: range.start.toISOString(), endDate: range.end.toISOString(), ...Object.fromEntries(Object.entries(filters).filter(([key, value]) => value && key !== "search")) };
    try {
      const [eventData, summaryData, technicianData] = await Promise.all([fetchCalendarEvents(token, params), fetchCalendarSummary(token, params), fetchTechnicians(token)]);
      setEvents(eventData.events || []); setSummary(summaryData.summary || {}); setTechnicians(technicianData.technicians || []);
    } catch (error) { notify?.(error.message || "Não foi possível carregar a agenda.", "danger"); }
    finally { setLoading(false); }
  }, [filters, notify, range.end, range.start, token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!focusServiceOrder) return;
    setModal({
      date: new Date(),
      defaults: {
        title: `Atendimento ${focusServiceOrder.number} · ${focusServiceOrder.title}`,
        eventType: "service_order",
        serviceOrderId: focusServiceOrder.id,
        assetId: focusServiceOrder.assetId || ""
      }
    });
    onFocusHandled?.();
  }, [focusServiceOrder, onFocusHandled]);

  const visibleEvents = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase("pt-BR");
    return search ? events.filter((event) => [event.title, event.description, event.serviceOrderNumber, event.technicianName].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(search))) : events;
  }, [events, filters.search]);
  const grouped = useMemo(() => eventsByDay(visibleEvents), [visibleEvents]);
  const days = useMemo(() => buildCalendarDays(anchor, view), [anchor, view]);

  function move(direction) { setAnchor((current) => { const next = new Date(current); if (view === "month") next.setMonth(next.getMonth() + direction); else next.setDate(next.getDate() + direction * (view === "week" ? 7 : 1)); return next; }); }
  async function save(payload) {
    setSaving(true);
    try { if (modal?.event) await updateCalendarEvent(token, modal.event.id, payload); else await createCalendarEvent(token, payload); notify?.(modal?.event ? "Agendamento atualizado." : "Agendamento criado.", "ok"); setModal(null); await load(); }
    catch (error) { notify?.(error.message || "Não foi possível salvar o agendamento.", "danger"); }
    finally { setSaving(false); }
  }
  async function cancel(event) { const reason = window.prompt("Motivo do cancelamento (opcional):", ""); if (reason === null) return; await cancelCalendarEvent(token, event.id, reason); setModal(null); notify?.("Agendamento cancelado.", "ok"); load(); }
  async function remove(event) { if (!window.confirm(`Excluir definitivamente "${event.title}"?`)) return; await deleteCalendarEvent(token, event.id); setModal(null); notify?.("Agendamento excluído.", "ok"); load(); }

  return <section className="technical-calendar-page">
    <header className="calendar-page-heading"><div><span className="calendar-eyebrow"><CalendarDays size={16} /> Planejamento operacional</span><h2>Agenda Técnica</h2><p>OS, visitas, preventivas e verificações organizadas em uma única linha do tempo.</p></div>{permissions.create ? <button type="button" className="primary-action" onClick={() => setModal({ date: new Date() })}><Plus size={17} /> Novo agendamento</button> : null}</header>
    <div className="calendar-summary-strip">
      <div><CalendarDays size={17} /><span>Hoje<strong>{summary.today || 0}</strong></span></div><div><Clock3 size={17} /><span>Atrasados<strong>{summary.overdue || 0}</strong></span></div><div><UserRoundCheck size={17} /><span>Técnicos ocupados<strong>{summary.busyTechnicians || 0}</strong></span></div><div><span>OS agendadas<strong>{summary.serviceOrders || 0}</strong></span></div><div><span>Preventivas<strong>{summary.preventiveMaintenance || 0}</strong></span></div>
    </div>
    <div className="calendar-toolbar">
      <div className="calendar-navigation"><button type="button" className="secondary-action" onClick={() => setAnchor(new Date())}>Hoje</button><button type="button" className="icon-button" onClick={() => move(-1)} aria-label="Período anterior"><ChevronLeft /></button><button type="button" className="icon-button" onClick={() => move(1)} aria-label="Próximo período"><ChevronRight /></button><h3>{formatHeader(anchor, view)}</h3></div>
      <div className="calendar-view-switch" aria-label="Visualização">{["month", "week", "day"].map((id) => <button key={id} type="button" className={view === id ? "active" : ""} onClick={() => setView(id)}>{id === "month" ? "Mês" : id === "week" ? "Semana" : "Dia"}</button>)}</div>
    </div>
    <div className="calendar-filters">
      <label><Search size={16} /><input value={filters.search} onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))} placeholder="Buscar título, OS ou técnico" /></label>
      <select aria-label="Filtrar por técnico" value={filters.technicianId} onChange={(e) => setFilters((current) => ({ ...current, technicianId: e.target.value }))}><option value="">Todos os técnicos</option>{technicians.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select aria-label="Filtrar por tipo" value={filters.eventType} onChange={(e) => setFilters((current) => ({ ...current, eventType: e.target.value }))}><option value="">Todos os tipos</option>{Object.entries(EVENT_TYPE_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}</select>
      <select aria-label="Filtrar por status" value={filters.status} onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}><option value="">Todos os status</option>{Object.entries(EVENT_STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <select aria-label="Filtrar por prioridade" value={filters.priority} onChange={(e) => setFilters((current) => ({ ...current, priority: e.target.value }))}><option value="">Todas as prioridades</option><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select>
      <select aria-label="Filtrar por grupo" value={filters.groupId} onChange={(e) => setFilters((current) => ({ ...current, groupId: e.target.value, segmentId: "" }))}><option value="">Todos os grupos</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select aria-label="Filtrar por segmento" value={filters.segmentId} onChange={(e) => setFilters((current) => ({ ...current, segmentId: e.target.value }))}><option value="">Todos os segmentos</option>{filterSegments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select aria-label="Filtrar por OS" value={filters.serviceOrderId} onChange={(e) => setFilters((current) => ({ ...current, serviceOrderId: e.target.value }))}><option value="">Todas as OS</option>{serviceOrders.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.title}</option>)}</select>
      <button type="button" className="icon-button" onClick={load} title="Atualizar"><RefreshCw size={16} /></button>
    </div>
    <div className={`calendar-surface view-${view} ${loading ? "is-loading" : ""}`}>
      {view !== "day" ? <div className="calendar-weekday-row">{(view === "week" ? days : WEEK_DAYS).slice(0, 7).map((item, index) => <span key={dateKey(item instanceof Date ? item : new Date(2026, 0, index + 4))}>{item instanceof Date ? <><small>{WEEK_DAYS[item.getDay()]}</small>{item.getDate()}</> : item}</span>)}</div> : null}
      <div className="calendar-day-grid">{days.map((day) => { const dayEvents = grouped.get(dateKey(day)) || []; const outside = view === "month" && day.getMonth() !== anchor.getMonth(); return <button type="button" className={`calendar-day-cell ${outside ? "outside" : ""} ${dateKey(day) === dateKey(new Date()) ? "today" : ""}`} key={dateKey(day)} onClick={() => permissions.create && setModal({ date: day })}><span className="calendar-day-number">{view === "day" ? day.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) : day.getDate()}</span><div className="calendar-day-events">{dayEvents.slice(0, view === "month" ? 3 : 12).map((event) => <CalendarEvent key={event.id} event={event} onClick={(selected) => setModal({ event: selected })} />)}{view === "month" && dayEvents.length > 3 ? <span className="calendar-more-events">+ {dayEvents.length - 3} eventos</span> : null}</div></button>; })}</div>
      {!loading && !visibleEvents.length ? <div className="calendar-empty-state"><CalendarDays size={30} /><strong>Nenhum agendamento neste período</strong><span>Clique em uma data para planejar o próximo atendimento.</span></div> : null}
    </div>
    {modal ? <CalendarEventModal event={modal.event} selectedDate={modal.date} defaults={modal.defaults} technicians={technicians} serviceOrders={serviceOrders} devices={devices} segments={segments} groups={groups} permissions={permissions} saving={saving} onClose={() => setModal(null)} onSave={save} onCancel={cancel} onDelete={remove} /> : null}
  </section>;
}
