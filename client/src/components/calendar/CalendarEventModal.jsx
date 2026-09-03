import { useEffect, useState } from "react";
import { CalendarClock, Trash2, X } from "lucide-react";
import { EVENT_STATUS_LABELS, EVENT_TYPE_META, PRIORITY_LABELS, toLocalInput } from "./calendarModel.js";

function initialForm(event, selectedDate, defaults = {}) {
  const start = event?.startAt || defaults.startAt || (() => { const date = new Date(selectedDate || Date.now()); date.setHours(9, 0, 0, 0); return date; })();
  const end = event?.endAt || new Date(new Date(start).getTime() + 60 * 60_000);
  return {
    title: event?.title || defaults.title || "",
    eventType: event?.eventType || defaults.eventType || "technical_visit",
    status: event?.status || "scheduled",
    priority: event?.priority || "normal",
    startAt: toLocalInput(start), endAt: toLocalInput(end), allDay: Boolean(event?.allDay),
    technicianId: event?.technicianId || defaults.technicianId || "", serviceOrderId: event?.serviceOrderId || defaults.serviceOrderId || "", assetId: event?.assetId || defaults.assetId || "",
    segmentId: event?.segmentId || "", groupId: event?.groupId || "", environmentName: event?.environmentName || "",
    description: event?.description || ""
  };
}

export default function CalendarEventModal({ event, selectedDate, defaults, technicians, serviceOrders, devices, segments, groups, permissions, saving, onClose, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState(() => initialForm(event, selectedDate, defaults));
  useEffect(() => setForm(initialForm(event, selectedDate, defaults)), [defaults, event, selectedDate]);
  const set = (field) => (e) => setForm((current) => ({ ...current, [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  function submit(e) {
    e.preventDefault();
    onSave({ ...form, startAt: new Date(form.startAt).toISOString(), endAt: form.endAt ? new Date(form.endAt).toISOString() : null });
  }

  return (
    <div className="calendar-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="calendar-event-modal" onSubmit={submit} aria-label={event ? "Editar agendamento" : "Novo agendamento"}>
        <header><div><span className="calendar-eyebrow"><CalendarClock size={15} /> Agenda técnica</span><h2>{event ? "Detalhes do agendamento" : "Novo agendamento"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>
        <div className="calendar-form-grid">
          <label className="calendar-field-wide">Título<input value={form.title} onChange={set("title")} minLength={3} maxLength={160} required /></label>
          <label>Tipo<select value={form.eventType} onChange={set("eventType")}>{Object.entries(EVENT_TYPE_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}</select></label>
          <label>Prioridade<select value={form.priority} onChange={set("priority")}>{Object.entries(PRIORITY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>Status<select value={form.status} onChange={set("status")}>{Object.entries(EVENT_STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="calendar-check"><input type="checkbox" checked={form.allDay} onChange={set("allDay")} /> Dia inteiro</label>
          <label>Início<input type="datetime-local" value={form.startAt} onChange={set("startAt")} required /></label>
          <label>Término<input type="datetime-local" value={form.endAt} onChange={set("endAt")} /></label>
          <label>Técnico<select value={form.technicianId} onChange={set("technicianId")} disabled={!permissions.assignTechnician}><option value="">Não atribuído</option>{technicians.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Ordem de Serviço<select value={form.serviceOrderId} onChange={set("serviceOrderId")}><option value="">Sem OS vinculada</option>{serviceOrders.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.title}</option>)}</select></label>
          <label>Ativo<select value={form.assetId} onChange={set("assetId")}><option value="">Sem ativo vinculado</option>{devices.map((item) => <option key={item.id} value={item.id}>{item.alias || item.hostname || item.name || item.id}</option>)}</select></label>
          <label>Segmento<select value={form.segmentId} onChange={set("segmentId")}><option value="">Sem segmento</option>{segments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Grupo<select value={form.groupId} onChange={set("groupId")}><option value="">Sem grupo</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Ambiente<input value={form.environmentName} onChange={set("environmentName")} placeholder="Unidade, cliente ou sala" /></label>
          <label className="calendar-field-wide">Descrição<textarea value={form.description} onChange={set("description")} rows={4} placeholder="Contexto, materiais e orientações para o atendimento" /></label>
        </div>
        <footer>
          <div className="calendar-destructive-actions">{event && permissions.cancel ? <button type="button" className="secondary-action" onClick={() => onCancel(event)}>Cancelar evento</button> : null}{event && permissions.delete ? <button type="button" className="danger-action" onClick={() => onDelete(event)}><Trash2 size={15} /> Excluir</button> : null}</div>
          <div><button type="button" className="secondary-action" onClick={onClose}>Voltar</button><button type="submit" className="primary-action" disabled={saving || (event ? !permissions.update : !permissions.create)}>{saving ? "Salvando..." : event ? "Salvar alterações" : "Criar agendamento"}</button></div>
        </footer>
      </form>
    </div>
  );
}
