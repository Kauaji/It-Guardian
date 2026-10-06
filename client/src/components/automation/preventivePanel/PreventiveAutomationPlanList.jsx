import { formatPanelDate, getScopeLabel } from "./preventiveAutomationPanelUtils.js";

function PreventiveAutomationPlanCard({ plan, scopeSources, permissions, toggling, onToggle, onEdit }) {
  const { canUpdate, canDisable } = permissions;

  return (
    <article className={`preventive-automation-card ${plan.active === false ? "inactive" : ""}`}>
      <header>
        <div className="preventive-automation-title-row">
          <strong>{plan.name}</strong>
          <span className={`pill ${plan.active === false ? "danger" : "ok"}`}>{plan.active === false ? "Inativo" : "Ativo"}</span>
        </div>
        <small>{plan.description || "Sem descrição informada"}</small>
      </header>
      <dl>
        <div>
          <dt>Horário</dt>
          <dd>
            {plan.preferredTime || "08:00"} - {plan.timezone || "America/Sao_Paulo"}
          </dd>
        </div>
        <div>
          <dt>Escopo</dt>
          <dd>{getScopeLabel(plan, scopeSources)}</dd>
        </div>
        <div>
          <dt>Próxima preparação</dt>
          <dd>{formatPanelDate(plan.nextRunAt || plan.nextScheduledFor)}</dd>
        </div>
        <div>
          <dt>Exceções</dt>
          <dd>{Array.isArray(plan.overrides) && plan.overrides.length ? `${plan.overrides.length} personalizada(s)` : "Sem exceções"}</dd>
        </div>
      </dl>
      <footer>
        {(canDisable || canUpdate) && (
          <label className="preventive-automation-switch" title={plan.active === false ? "Ativar automação" : "Desativar automação"}>
            <input
              type="checkbox"
              checked={plan.active !== false}
              disabled={toggling || (!canDisable && plan.active !== false) || (!canUpdate && plan.active === false)}
              onChange={() => onToggle(plan)}
            />
            <span />
          </label>
        )}
        {canUpdate && (
          <button type="button" className="secondary-action compact-action" onClick={() => onEdit(plan)}>
            Editar
          </button>
        )}
      </footer>
    </article>
  );
}

// Cabecalho e grade de planos da variante isolada (nao embutida) do painel.
export default function PreventiveAutomationPlanList({ plans, scopeSources, permissions, togglingId, onCreate, onEdit, onToggle }) {
  return (
    <>
      <div className="panel-heading">
        <div>
          <h2>Automação Preventiva</h2>
          <p>A automação agenda e prepara rotinas. A execução real dependerá de agente seguro.</p>
        </div>
        {permissions.canCreate && (
          <button type="button" className="primary-action compact-action" onClick={() => onCreate()}>
            Novo plano
          </button>
        )}
      </div>

      <div className="preventive-automation-grid">
        {plans.map((plan) => (
          <PreventiveAutomationPlanCard
            key={plan.id}
            plan={plan}
            scopeSources={scopeSources}
            permissions={permissions}
            toggling={togglingId === plan.id}
            onToggle={onToggle}
            onEdit={onEdit}
          />
        ))}

        {!plans.length && <p className="empty">Nenhum plano de automação preventiva cadastrado ainda.</p>}
      </div>
    </>
  );
}
