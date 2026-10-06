import { dayCellClassName, dayPriorityColor } from "../utils/calendarPage.js";
import CalendarEvent from "./CalendarEvent.jsx";

const MAX_VISIBLE_EVENTS = 2;

export default function CalendarDayCell({ day, anchor, events, canCreate, onOpenDay, onOpenEvent }) {
  const openDay = () => canCreate && onOpenDay(day);
  return (
    <div className={dayCellClassName(day, anchor, events)} style={{ "--day-priority-color": dayPriorityColor(events) }} onClick={openDay}>
      {canCreate ? (
        <button
          type="button"
          className="calendar-day-number"
          aria-label={`Novo agendamento em ${day.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`}
          onClick={(event) => {
            event.stopPropagation();
            openDay();
          }}
        >
          {day.getDate()}
        </button>
      ) : (
        <span className="calendar-day-number">{day.getDate()}</span>
      )}
      <div className="calendar-day-events">
        {events.slice(0, MAX_VISIBLE_EVENTS).map((event) => (
          <CalendarEvent key={event.id} event={event} onClick={onOpenEvent} />
        ))}
        {events.length > MAX_VISIBLE_EVENTS ? (
          <span className="calendar-more-events">+ {events.length - MAX_VISIBLE_EVENTS} eventos</span>
        ) : null}
      </div>
    </div>
  );
}
