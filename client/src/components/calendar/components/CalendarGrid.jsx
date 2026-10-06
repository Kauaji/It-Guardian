import { CalendarDays } from "lucide-react";
import { dateKey } from "../calendarModel.js";
import { WEEK_DAYS } from "../utils/calendarPage.js";
import CalendarDayCell from "./CalendarDayCell.jsx";

export default function CalendarGrid({ days, anchor, grouped, loading, hasEvents, canCreate, onOpenDay, onOpenEvent }) {
  return (
    <div className={`calendar-surface view-month ${loading ? "is-loading" : ""}`}>
      <div className="calendar-weekday-row">
        {WEEK_DAYS.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div className="calendar-day-grid">
        {days.map((day) => (
          <CalendarDayCell
            key={dateKey(day)}
            day={day}
            anchor={anchor}
            events={grouped.get(dateKey(day)) || []}
            canCreate={canCreate}
            onOpenDay={onOpenDay}
            onOpenEvent={onOpenEvent}
          />
        ))}
      </div>
      {!loading && !hasEvents ? (
        <div className="calendar-empty-state">
          <CalendarDays size={30} />
          <strong>Nenhum agendamento neste período</strong>
          <span>Clique em uma data para planejar o próximo atendimento.</span>
        </div>
      ) : null}
    </div>
  );
}
