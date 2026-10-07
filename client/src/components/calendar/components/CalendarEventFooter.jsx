import { CheckCircle2, Trash2 } from "lucide-react";

export default function CalendarEventFooter({ event, permissions, saving, onClose, onCancel, onComplete, onDelete }) {
  return (
    <footer>
      <div className="calendar-destructive-actions">
        {event && permissions.update && !["completed", "cancelled"].includes(event.status) ? (
          <button type="button" className="calendar-complete-action" onClick={() => onComplete(event)} disabled={saving}>
            <CheckCircle2 size={15} /> Concluir evento
          </button>
        ) : null}
        {event && permissions.cancel && event.status !== "cancelled" ? (
          <button type="button" className="secondary-action" onClick={() => onCancel(event)}>
            Cancelar evento
          </button>
        ) : null}
        {event && permissions.delete ? (
          <button type="button" className="danger-action" onClick={() => onDelete(event)}>
            <Trash2 size={15} /> Excluir
          </button>
        ) : null}
      </div>
      <div>
        <button type="button" className="secondary-action" onClick={onClose}>
          Voltar
        </button>
        <button type="submit" className="primary-action" disabled={saving || (event ? !permissions.update : !permissions.create)}>
          {saving ? "Salvando..." : event ? "Salvar alterações" : "Criar agendamento"}
        </button>
      </div>
    </footer>
  );
}
