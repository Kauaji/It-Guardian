import { formatDate } from "../../../utils/display.js";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";

// Resumo do ultimo plano registrado, com o atalho para criar/abrir a OS preventiva.
export default function PreventiveCreatedSummary({ plan, savingId, onCreateServiceOrder, onOpenServiceOrder }) {
  const { perms } = useAlertCenterView();

  return (
    <section className="preventive-created-summary">
      <div>
        <span>Plano registrado</span>
        <strong>{plan.name}</strong>
        <small>
          {plan.assets?.length || 0} máquina(s) • {plan.scripts?.length || 0} verificação(ões) •{" "}
          {formatDate(plan.preparedAt || plan.createdAt)}
        </small>
      </div>
      {plan.serviceOrderId ? (
        <button type="button" className="secondary-action compact-action" onClick={onOpenServiceOrder}>
          Abrir OS preventiva
        </button>
      ) : (
        <button
          type="button"
          className="primary-action compact-action"
          disabled={!perms.canCreatePreventiveServiceOrder || savingId === plan.id}
          onClick={() => onCreateServiceOrder(plan)}
        >
          {savingId === plan.id ? "Criando OS..." : "Criar OS preventiva"}
        </button>
      )}
    </section>
  );
}
