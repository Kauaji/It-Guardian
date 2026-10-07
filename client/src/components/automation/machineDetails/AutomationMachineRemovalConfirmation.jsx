import { Trash2 } from "lucide-react";

export default function AutomationMachineRemovalConfirmation({
  machine,
  plan,
  isLastPlanAsset,
  canDeletePlan,
  busy,
  onCancel,
  onDeletePlan,
  onRemoveAsset
}) {
  return (
    <section className="automation-remove-confirmation">
      <Trash2 size={24} />
      <h3>Remover plano da máquina</h3>
      <p>
        A máquina <strong>{machine.assetName}</strong> será removida do plano <strong>{plan.planName || plan.name}</strong>. A agenda futura
        desta máquina será desativada e o histórico será preservado.
      </p>
      {isLastPlanAsset ? (
        <p className="warning">
          Esta é a última máquina ativa do plano. Você pode manter o plano inativo ou excluí-lo definitivamente da listagem.
        </p>
      ) : (
        <p>As outras máquinas continuarão vinculadas ao plano.</p>
      )}
      <div className="modal-actions">
        <button type="button" className="secondary-action compact-action" onClick={onCancel}>
          Cancelar
        </button>
        {isLastPlanAsset && canDeletePlan && (
          <button type="button" className="danger-action compact-action" disabled={busy} onClick={() => onDeletePlan(plan)}>
            Excluir plano
          </button>
        )}
        <button
          type="button"
          className="danger-action compact-action"
          disabled={busy}
          onClick={() => onRemoveAsset(plan.id, machine.assetId)}
        >
          {isLastPlanAsset ? "Manter plano inativo" : "Remover plano da máquina"}
        </button>
      </div>
    </section>
  );
}
