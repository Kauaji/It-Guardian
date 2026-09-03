import { useEffect, useState } from "react";
import { CalendarClock, Trash2, X } from "lucide-react";
import { EVENT_STATUS_LABELS, EVENT_TYPE_META, PRIORITY_LABELS, toLocalInput } from "./calendarModel.js";

function normalizedName(value = "") {
  return String(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

function isMaintenanceSegment(segment) {
  return normalizedName(segment?.name) === "manutencao";
}

function isFinalizedServiceOrder(order) {
  return Boolean(order?.closedAt) || ["closed", "completed", "finalized", "finished", "resolved", "concluida", "concluido", "finalizada", "finalizado"]
    .includes(normalizedName(order?.status));
}

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
    tabId: "", segmentId: event?.segmentId || "", groupId: event?.groupId || "",
    description: event?.description || ""
  };
}

export default function CalendarEventModal({ event, selectedDate, defaults, technicians, serviceOrders, devices, segments, groups, tabs, permissions, saving, onClose, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState(() => initialForm(event, selectedDate, defaults));
  useEffect(() => setForm(initialForm(event, selectedDate, defaults)), [defaults, event, selectedDate]);
  const set = (field) => (e) => setForm((current) => ({ ...current, [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const selectableOrders = serviceOrders.filter((item) => !isFinalizedServiceOrder(item));
  const selectableSegments = segments.filter((item) => !item.isDefault && !isMaintenanceSegment(item));
  const groupsForTab = form.tabId ? groups.filter((item) => item.tabId === form.tabId) : [];
  const segmentsForGroup = form.groupId
    ? selectableSegments.filter((item) => item.groupId === form.groupId && (!form.tabId || item.tabId === form.tabId))
    : [];
  const devicesForSegment = form.segmentId
    ? devices.filter((item) => item.segmentId === form.segmentId)
    : [];

  useEffect(() => {
    const selectedDevice = devices.find((item) => item.id === form.assetId);
    const selectedSegment = segments.find((item) => item.id === (selectedDevice?.segmentId || form.segmentId));
    const selectedGroup = groups.find((item) => item.id === (selectedSegment?.groupId || form.groupId));
    const tabId = selectedDevice?.tabId || selectedSegment?.tabId || selectedGroup?.tabId || "";
    if (!form.tabId && tabId) {
      setForm((current) => ({
        ...current,
        tabId,
        groupId: current.groupId || selectedSegment?.groupId || "",
        segmentId: current.segmentId || selectedDevice?.segmentId || ""
      }));
    }
  }, [devices, form.assetId, form.groupId, form.segmentId, form.tabId, groups, segments]);

  function selectHierarchy(field, value) {
    setForm((current) => {
      if (field === "tabId") return { ...current, tabId: value, groupId: "", segmentId: "", assetId: "" };
      if (field === "groupId") return { ...current, groupId: value, segmentId: "", assetId: "" };
      if (field === "segmentId") return { ...current, segmentId: value, assetId: "" };
      return { ...current, [field]: value };
    });
  }

  function selectServiceOrder(serviceOrderId) {
    const order = selectableOrders.find((item) => item.id === serviceOrderId);
    const device = devices.find((item) => item.id === order?.assetId);
    const segment = segments.find((item) => item.id === device?.segmentId);
    const group = groups.find((item) => item.id === segment?.groupId);
    setForm((current) => ({
      ...current,
      serviceOrderId,
      assetId: device?.id || current.assetId,
      segmentId: segment && !isMaintenanceSegment(segment) ? segment.id : current.segmentId,
      groupId: group?.id || current.groupId,
      tabId: device?.tabId || segment?.tabId || group?.tabId || current.tabId
    }));
  }

  function submit(e) {
    e.preventDefault();
    const payload = { ...form };
    delete payload.tabId;
    onSave({ ...payload, environmentName: null, startAt: new Date(form.startAt).toISOString(), endAt: form.endAt ? new Date(form.endAt).toISOString() : null });
  }

  return (
    <div className="calendar-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="calendar-event-modal" onSubmit={submit} aria-label={event ? "Editar agendamento" : "Novo agendamento"}>
        <header><div><span className="calendar-eyebrow"><CalendarClock size={15} /> Agenda técnica</span><h2>{event ? "Editar agendamento" : "Novo agendamento"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>
        <div className="calendar-form-grid">
          <label className="calendar-field-wide">Título<input value={form.title} onChange={set("title")} minLength={3} maxLength={160} required /></label>
          <label>Tipo<select value={form.eventType} onChange={set("eventType")}>{Object.entries(EVENT_TYPE_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}</select></label>
          <label>Prioridade<select value={form.priority} onChange={set("priority")}>{Object.entries(PRIORITY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>Status<select value={form.status} onChange={set("status")}>{Object.entries(EVENT_STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="calendar-check"><input type="checkbox" checked={form.allDay} onChange={set("allDay")} /> Dia inteiro</label>
          {!form.allDay ? <><label>Início<input type="datetime-local" value={form.startAt} onChange={set("startAt")} required /></label><label>Término<input type="datetime-local" value={form.endAt} onChange={set("endAt")} /></label></> : null}
          <label>Técnico<select value={form.technicianId} onChange={set("technicianId")} disabled={!permissions.assignTechnician}><option value="">Não atribuído</option>{technicians.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Ordem de Serviço<select value={form.serviceOrderId} onChange={(event) => selectServiceOrder(event.target.value)}><option value="">Sem OS vinculada</option>{selectableOrders.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.title}</option>)}</select></label>
          <label>Aba<select value={form.tabId} onChange={(event) => selectHierarchy("tabId", event.target.value)}><option value="">Selecione a aba</option>{tabs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Grupo<select value={form.groupId} onChange={(event) => selectHierarchy("groupId", event.target.value)} disabled={!form.tabId}><option value="">Selecione o grupo</option>{groupsForTab.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Segmento<select value={form.segmentId} onChange={(event) => selectHierarchy("segmentId", event.target.value)} disabled={!form.groupId}><option value="">Selecione o segmento</option>{segmentsForGroup.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Máquina/ativo<select value={form.assetId} onChange={set("assetId")} disabled={!form.segmentId}><option value="">Sem ativo vinculado</option>{devicesForSegment.map((item) => <option key={item.id} value={item.id}>{item.alias || item.hostname || item.name || item.id}</option>)}</select></label>
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
