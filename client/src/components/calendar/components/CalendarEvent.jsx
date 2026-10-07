import { EVENT_TYPE_META, PRIORITY_META } from "../calendarModel.js";
import { formatEventTime } from "../utils/calendarPage.js";

export default function CalendarEvent({ event, onClick }) {
  const meta = EVENT_TYPE_META[event.eventType] || EVENT_TYPE_META.other;
  const priority = PRIORITY_META[event.priority] || PRIORITY_META.normal;
  return (
    <button
      type="button"
      className={`calendar-event status-${event.status} priority-${event.priority || "normal"}`}
      style={{ "--event-color": priority.color }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      title={`${meta.label} · prioridade ${priority.label.toLowerCase()} · ${event.technicianName || "Sem técnico"}`}
    >
      <time>{formatEventTime(event)}</time>
      <span>
        {event.serviceOrderNumber ? `${event.serviceOrderNumber} · ` : ""}
        {event.title}
      </span>
    </button>
  );
}
