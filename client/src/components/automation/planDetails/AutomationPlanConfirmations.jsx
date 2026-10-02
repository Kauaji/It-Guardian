import { Pause, Play, Trash2 } from "lucide-react";

export function AutomationPlanDeleteConfirmation({ plan, deleteConfirmation, busy, onChange, onCancel, onConfirm }) {
  return (
    <section className="automation-delete-confirmation">
      <Trash2 size={24} />
      <h3>Excluir plano</h3>
      <p>
        Você está prestes a excluir o plano <strong>{plan.name}</strong>. Ele será removido de{" "}
        {plan.assetCount || plan.assetSchedules?.filter((item) => item.active !== false).length || 0} máquina(s).
        Agendas futuras serão desativadas e o histórico será preservado.
      </p>
      <label>
        Digite o nome do plano para confirmar
        <input value={deleteConfirmation} onChange={(event) => onChange(event.target.value)} />
      </label>
      <div className="modal-actions">
        <button type="button" className="secondary-action compact-action" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="danger-action compact-action"
          disabled={busy || deleteConfirmation !== plan.name}
          onClick={() => onConfirm(plan)}
        >
          Excluir plano
        </button>
      </div>
    </section>
  );
}

export function AutomationPlanStatusConfirmation({ plan, busy, onCancel, onConfirm }) {
  const inactive = plan.active === false;

  return (
    <section className="automation-status-confirmation">
      {inactive ? <Play size={24} /> : <Pause size={24} />}
      <h3>{inactive ? "Reativar automação" : "Pausar automação"}</h3>
      <p>
        {inactive
          ? "As agendas vinculadas voltarão a ficar ativas e serão sincronizadas."
          : "As agendas vinculadas serão pausadas sem apagar o plano ou seu histórico."}
      </p>
      <div className="modal-actions">
        <button type="button" className="secondary-action compact-action" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="primary-action compact-action" disabled={busy} onClick={onConfirm}>
          {inactive ? "Reativar automação" : "Pausar automação"}
        </button>
      </div>
    </section>
  );
}
