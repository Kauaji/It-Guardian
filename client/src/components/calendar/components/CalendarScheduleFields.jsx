import { EVENT_STATUS_LABELS, EVENT_TYPE_META, PRIORITY_LABELS } from "../calendarModel.js";

// Titulo, classificacao e janela de horario do evento (campos do inicio da grade do formulario).
export default function CalendarScheduleFields({ form, set }) {
  return (
    <>
      <label className="calendar-field-wide">
        Título
        <input value={form.title} onChange={set("title")} minLength={3} maxLength={160} required />
      </label>
      <label>
        Tipo
        <select value={form.eventType} onChange={set("eventType")}>
          {Object.entries(EVENT_TYPE_META).map(([id, meta]) => (
            <option key={id} value={id}>
              {meta.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Prioridade
        <select value={form.priority} onChange={set("priority")}>
          {Object.entries(PRIORITY_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={form.status} onChange={set("status")}>
          {Object.entries(EVENT_STATUS_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="calendar-check">
        <input type="checkbox" checked={form.allDay} onChange={set("allDay")} /> Dia inteiro
      </label>
      {!form.allDay ? (
        <>
          <label>
            Início
            <input type="datetime-local" value={form.startAt} onChange={set("startAt")} required />
          </label>
          <label>
            Término
            <input type="datetime-local" value={form.endAt} onChange={set("endAt")} />
          </label>
        </>
      ) : null}
    </>
  );
}
