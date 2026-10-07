import { CalendarClock, ExternalLink } from "lucide-react";
import { formatAutomationDate, formatRecurrence } from "../automationUtils.js";
import { recurrenceOriginLabel } from "./machineDetailsUtils.js";

function PlanHeading({ plan, effectiveOrigin }) {
  return (
    <section className="automation-machine-plan-heading">
      <i style={{ backgroundColor: plan.indicatorColor }} />
      <div>
        <strong>{plan.planName || plan.name}</strong>
        <small>{plan.active ? "Agenda ativa" : "Agenda inativa"}</small>
      </div>
      <span className={`pill automation-recurrence-origin ${effectiveOrigin === "machine" ? "personalized" : ""}`}>
        {recurrenceOriginLabel(effectiveOrigin)}
      </span>
    </section>
  );
}

function OverviewGrid({ plan, schedule, effectiveOrigin }) {
  return (
    <section className="automation-machine-overview">
      <div>
        <span>Recorrência geral</span>
        <strong>{formatRecurrence(plan)}</strong>
      </div>
      <div>
        <span>Recorrência efetiva</span>
        <strong>{formatRecurrence(schedule)}</strong>
      </div>
      <div>
        <span>Origem</span>
        <strong>{recurrenceOriginLabel(effectiveOrigin)}</strong>
      </div>
      <div>
        <span>Próxima preparação</span>
        <strong>{formatAutomationDate(schedule.nextRunAt)}</strong>
      </div>
      <div>
        <span>Última preparação</span>
        <strong>{formatAutomationDate(schedule.lastPreparedAt, "Ainda não preparada")}</strong>
      </div>
      <div>
        <span>Último resultado</span>
        <strong>{schedule.latestRun?.status || "Sem execução registrada"}</strong>
      </div>
      <div>
        <span>Horário</span>
        <strong>{schedule.preferredTime}</strong>
      </div>
      <div>
        <span>Fuso</span>
        <strong>{schedule.timezone}</strong>
      </div>
      <div>
        <span>Scripts</span>
        <strong>{plan.scriptCount || 0}</strong>
      </div>
    </section>
  );
}

// Visao geral da maquina no plano selecionado, com historico, scripts e acoes.
export default function AutomationMachineOverview({
  plan,
  schedule,
  detail,
  effectiveOrigin,
  detailLoading,
  permissions,
  onOpenPlan,
  onEditOverride,
  onRemove,
  onClose
}) {
  return (
    <>
      <PlanHeading plan={plan} effectiveOrigin={effectiveOrigin} />
      <OverviewGrid plan={plan} schedule={schedule} effectiveOrigin={effectiveOrigin} />
      {detail?.history?.length > 0 && (
        <section className="automation-machine-history">
          <h3>Histórico recente</h3>
          {detail.history.map((item) => (
            <article key={item.id}>
              <strong>{item.message}</strong>
              <small>
                {formatAutomationDate(item.createdAt)} • {item.userName || "Sistema"}
              </small>
            </article>
          ))}
        </section>
      )}
      <section className="automation-machine-script-list">
        <h3>Scripts vinculados</h3>
        {(plan.scripts || []).map((script) => (
          <span key={script.id}>{script.name}</span>
        ))}
        {!plan.scripts?.length && <p>Nenhum script identificado.</p>}
      </section>
      <footer>
        <button type="button" className="secondary-action compact-action" onClick={onOpenPlan}>
          <ExternalLink size={15} /> Ver detalhes do plano
        </button>
        {permissions.canManageOverride && (
          <button type="button" className="secondary-action compact-action" disabled={detailLoading} onClick={onEditOverride}>
            <CalendarClock size={15} /> Definir recorrência personalizada
          </button>
        )}
        {permissions.canRemoveAsset && (
          <button type="button" className="danger-action compact-action" onClick={onRemove}>
            Remover plano da máquina
          </button>
        )}
        <button type="button" className="primary-action compact-action" onClick={onClose}>
          Fechar
        </button>
      </footer>
    </>
  );
}
