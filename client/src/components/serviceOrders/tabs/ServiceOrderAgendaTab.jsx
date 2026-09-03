import { useEffect, useState } from "react";
import { CalendarClock, ExternalLink, Plus } from "lucide-react";
import { fetchCalendarEvents } from "../../../api.js";

export default function ServiceOrderAgendaTab({ token, serviceOrder, canCreate, onOpenCalendar }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = new Date();
    const end = new Date();
    start.setDate(start.getDate() - 31);
    end.setDate(end.getDate() + 61);
    fetchCalendarEvents(token, { startDate: start.toISOString(), endDate: end.toISOString(), serviceOrderId: serviceOrder.id })
      .then((data) => setEvents(data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [serviceOrder.id, token]);

  return (
    <section className="service-order-agenda-tab">
      <header>
        <div><h3><CalendarClock size={18} /> Agenda</h3><p>Atendimentos, visitas e retornos vinculados a esta Ordem de Serviço.</p></div>
        <div>
          {canCreate ? <button type="button" className="primary-action" onClick={() => onOpenCalendar?.(serviceOrder, true)}><Plus size={15} /> Agendar atendimento</button> : null}
          <button type="button" className="secondary-action" onClick={() => onOpenCalendar?.(serviceOrder, false)}><ExternalLink size={15} /> Abrir no calendário</button>
        </div>
      </header>
      {loading ? <p>Carregando agenda...</p> : events.length ? (
        <div className="service-order-agenda-list">{events.map((event) => <article key={event.id}><time>{new Date(event.startAt).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}</time><div><strong>{event.title}</strong><span>{event.technicianName || "Sem técnico"} · {event.status === "cancelled" ? "Cancelado" : event.status === "completed" ? "Concluído" : "Agendado"}</span></div></article>)}</div>
      ) : <div className="service-order-agenda-empty"><CalendarClock size={28} /><strong>Nenhum atendimento agendado</strong><span>Use o calendário para reservar data, horário e técnico.</span></div>}
    </section>
  );
}
