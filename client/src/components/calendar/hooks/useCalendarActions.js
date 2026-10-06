import { useEffect, useState } from "react";
import { cancelCalendarEvent, createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "../../../api.js";
import { buildServiceOrderDefaults } from "../utils/calendarPage.js";

// Estado do modal (`{ event, date, defaults }` ou null) e as acoes que o alteram no servidor.
export function useCalendarActions({ token, notify, load, focusServiceOrder, onFocusHandled }) {
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  // Uma OS em foco abre o formulario ja vinculado a ela.
  useEffect(() => {
    if (!focusServiceOrder) return;
    setModal({ date: new Date(), defaults: buildServiceOrderDefaults(focusServiceOrder) });
    onFocusHandled?.();
  }, [focusServiceOrder, onFocusHandled]);

  async function save(payload) {
    setSaving(true);
    try {
      if (modal?.event) await updateCalendarEvent(token, modal.event.id, payload);
      else await createCalendarEvent(token, payload);
      notify?.(modal?.event ? "Agendamento atualizado." : "Agendamento criado.", "ok");
      setModal(null);
      await load();
    } catch (error) {
      notify?.(error.message || "Não foi possível salvar o agendamento.", "danger");
    } finally {
      setSaving(false);
    }
  }
  async function cancel(event) {
    const reason = window.prompt("Motivo do cancelamento (opcional):", "");
    if (reason === null) return;
    await cancelCalendarEvent(token, event.id, reason);
    setModal(null);
    notify?.("Agendamento cancelado.", "ok");
    load();
  }
  async function complete(event) {
    setSaving(true);
    try {
      await updateCalendarEvent(token, event.id, { status: "completed" });
      setModal(null);
      notify?.("Agendamento concluído.", "ok");
      await load();
    } catch (error) {
      notify?.(error.message || "Não foi possível concluir o agendamento.", "danger");
    } finally {
      setSaving(false);
    }
  }
  async function remove(event) {
    if (!window.confirm(`Excluir definitivamente "${event.title}"?`)) return;
    await deleteCalendarEvent(token, event.id);
    setModal(null);
    notify?.("Agendamento excluído.", "ok");
    load();
  }

  return {
    modal,
    saving,
    openNew: () => setModal({ date: new Date() }),
    openDay: (date) => setModal({ date }),
    openEvent: (event) => setModal({ event }),
    closeModal: () => setModal(null),
    save,
    cancel,
    complete,
    remove
  };
}
