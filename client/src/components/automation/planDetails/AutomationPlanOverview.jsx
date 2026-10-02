import { Pause, Pencil, Play, Trash2 } from "lucide-react";
import { formatAutomationDate, formatRecurrence } from "../automationUtils.js";

function OverviewGrid({ plan }) {
  return (
    <section className="automation-plan-overview">
      <div><span>Status</span><strong>{plan.active === false ? "Inativo" : "Ativo"}</strong></div>
      <div><span>Recorrência geral</span><strong>{formatRecurrence(plan)}</strong></div>
      <div><span>Horário e fuso</span><strong>{plan.preferredTime} • {plan.timezone}</strong></div>
      <div><span>Próxima preparação</span><strong>{formatAutomationDate(plan.nextRunAt)}</strong></div>
      <div><span>Última preparação</span><strong>{formatAutomationDate(plan.lastPreparedAt, "Ainda não preparada")}</strong></div>
      <div><span>Máquinas vinculadas</span><strong>{plan.assetCount ?? plan.assetSchedules?.filter((item) => item.active !== false).length ?? 0}</strong></div>
      <div><span>Scripts</span><strong>{plan.scriptCount ?? plan.defaultScriptIds?.length ?? 0}</strong></div>
      <div><span>Recorrências personalizadas</span><strong>{plan.overrideCount ?? plan.overrides?.length ?? 0}</strong></div>
      <div><span>Criado por</span><strong>{plan.createdByName || "Sistema"}</strong></div>
      <div><span>Criado em</span><strong>{formatAutomationDate(plan.createdAt)}</strong></div>
      <div><span>Plano preventivo</span><strong>{plan.preventivePlanName || "Não vinculado"}</strong></div>
      <div className="automation-plan-color-preview"><span>Cor</span><strong><i style={{ backgroundColor: plan.indicatorColor }} />{plan.indicatorColor}</strong></div>
    </section>
  );
}

// Aba Resumo: indicadores, textos livres, scripts vinculados e acoes do plano.
export default function AutomationPlanOverview({ plan, linkedScripts, permissions, onEdit, onStatus, onDelete, onClose }) {
  const { canEdit, canStatus, canDelete } = permissions;

  return (
    <>
      <OverviewGrid plan={plan} />
      {(plan.description || plan.notes) && (
        <section className="automation-plan-copy">
          {plan.description && <div><strong>Descrição</strong><p>{plan.description}</p></div>}
          {plan.notes && <div><strong>Observações</strong><p>{plan.notes}</p></div>}
        </section>
      )}
      <section className="automation-plan-linked-scripts">
        <h3>Scripts vinculados</h3>
        {linkedScripts.length ? linkedScripts.map((script) => <span key={script.id}>{script.name}</span>) : <p>Nenhum script identificado.</p>}
      </section>
      <footer>
        {canEdit && <button type="button" className="secondary-action compact-action" onClick={onEdit}><Pencil size={15} /> Editar</button>}
        {canStatus && (
          <button type="button" className="secondary-action compact-action" onClick={onStatus}>
            {plan.active === false ? <Play size={15} /> : <Pause size={15} />}
            {plan.active === false ? "Reativar automação" : "Pausar automação"}
          </button>
        )}
        {canDelete && <button type="button" className="danger-action compact-action" onClick={onDelete}><Trash2 size={15} /> Excluir plano</button>}
        <button type="button" className="primary-action compact-action" onClick={onClose}>Fechar</button>
      </footer>
    </>
  );
}
