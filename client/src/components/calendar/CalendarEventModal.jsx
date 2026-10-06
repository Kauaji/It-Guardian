import { CalendarClock, X } from "lucide-react";
import { useModalLifecycle } from "../../hooks/useModalLifecycle.js";
import CalendarAssignmentFields from "./components/CalendarAssignmentFields.jsx";
import CalendarEventFooter from "./components/CalendarEventFooter.jsx";
import CalendarScheduleFields from "./components/CalendarScheduleFields.jsx";
import { useCalendarEventForm } from "./hooks/useCalendarEventForm.js";

export default function CalendarEventModal({
  event,
  selectedDate,
  defaults,
  technicians,
  serviceOrders,
  devices,
  segments,
  groups,
  tabs,
  permissions,
  saving,
  onClose,
  onSave,
  onCancel,
  onComplete,
  onDelete
}) {
  const eventForm = useCalendarEventForm({ event, selectedDate, defaults, serviceOrders, devices, segments, groups });
  const { form, set } = eventForm;
  const dialogRef = useModalLifecycle(true, onClose);

  function submit(e) {
    e.preventDefault();
    onSave(eventForm.buildPayload());
  }

  return (
    <div className="calendar-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        ref={dialogRef}
        className="calendar-event-modal"
        role="dialog"
        aria-modal="true"
        onSubmit={submit}
        aria-label={event ? "Editar agendamento" : "Novo agendamento"}
      >
        <header>
          <div>
            <span className="calendar-eyebrow">
              <CalendarClock size={15} /> Agenda técnica
            </span>
            <h2>{event ? "Editar agendamento" : "Novo agendamento"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        <div className="calendar-form-grid">
          <CalendarScheduleFields form={form} set={set} />
          <CalendarAssignmentFields
            form={form}
            set={set}
            permissions={permissions}
            technicians={technicians}
            tabs={tabs}
            orders={eventForm.orders}
            groupsForTab={eventForm.groupsForTab}
            segmentsForGroup={eventForm.segmentsForGroup}
            devicesForSegment={eventForm.devicesForSegment}
            onSelectHierarchy={eventForm.selectHierarchy}
            onSelectServiceOrder={eventForm.selectServiceOrder}
          />
        </div>
        <CalendarEventFooter
          event={event}
          permissions={permissions}
          saving={saving}
          onClose={onClose}
          onCancel={onCancel}
          onComplete={onComplete}
          onDelete={onDelete}
        />
      </form>
    </div>
  );
}
