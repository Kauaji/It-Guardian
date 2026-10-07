import { CalendarDays, Clock3, UserRoundCheck } from "lucide-react";

export default function CalendarSummaryStrip({ summary }) {
  return (
    <div className="calendar-summary-strip">
      <div>
        <CalendarDays size={17} />
        <span>
          Hoje<strong>{summary.today || 0}</strong>
        </span>
      </div>
      <div>
        <Clock3 size={17} />
        <span>
          Atrasados<strong>{summary.overdue || 0}</strong>
        </span>
      </div>
      <div>
        <UserRoundCheck size={17} />
        <span>
          Técnicos ocupados<strong>{summary.busyTechnicians || 0}</strong>
        </span>
      </div>
      <div>
        <span>
          OS agendadas<strong>{summary.serviceOrders || 0}</strong>
        </span>
      </div>
      <div>
        <span>
          Preventivas<strong>{summary.preventiveMaintenance || 0}</strong>
        </span>
      </div>
    </div>
  );
}
