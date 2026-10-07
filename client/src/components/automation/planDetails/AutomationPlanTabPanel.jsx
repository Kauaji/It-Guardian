import { formatAutomationDate, formatRecurrence } from "../automationUtils.js";

export const automationPlanTabs = [
  ["summary", "Resumo"],
  ["agenda", "Agenda"],
  ["machines", "Máquinas"],
  ["scripts", "Scripts"],
  ["history", "Histórico"]
];

export function AutomationPlanTabNav({ activeTab, onChange }) {
  return (
    <nav className="automation-plan-detail-tabs" role="tablist" aria-label="Detalhes do plano">
      {automationPlanTabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={activeTab === id}
          className={activeTab === id ? "active" : ""}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function AgendaPanel({ plan }) {
  return (
    <section className="automation-plan-tab-panel">
      <h3>Agenda por máquina</h3>
      <div className="automation-plan-list">
        {(plan.assetSchedules || []).map((schedule) => (
          <article key={schedule.assetId}>
            <strong>{schedule.assetName || schedule.assetId}</strong>
            <span>{formatRecurrence(schedule)}</span>
            <time>{formatAutomationDate(schedule.nextRunAt, "Sem próxima agenda")}</time>
          </article>
        ))}
      </div>
      {!plan.assetSchedules?.length && <p className="empty">Nenhuma agenda vinculada.</p>}
    </section>
  );
}

function MachinesPanel({ plan }) {
  return (
    <section className="automation-plan-tab-panel">
      <h3>Máquinas vinculadas</h3>
      <div className="automation-plan-list">
        {(plan.assetSchedules || []).map((schedule) => (
          <article key={schedule.assetId}>
            <strong>{schedule.assetName || schedule.assetId}</strong>
            <span>{schedule.active === false ? "Pausada" : "Ativa"}</span>
            <span>{schedule.recurrenceSource === "override" ? "Recorrência personalizada" : "Recorrência herdada"}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ScriptsPanel({ linkedScripts }) {
  return (
    <section className="automation-plan-tab-panel">
      <h3>Scripts vinculados</h3>
      <div className="automation-plan-list">
        {linkedScripts.map((script) => (
          <article key={script.id}>
            <strong>{script.name}</strong>
            <span>{script.category || "Sem categoria"}</span>
            <span>{script.risk || "Risco não informado"}</span>
          </article>
        ))}
      </div>
      {!linkedScripts.length && <p className="empty">Nenhum script vinculado.</p>}
    </section>
  );
}

function HistoryPanel({ history, historyLoading }) {
  return (
    <section className="automation-plan-tab-panel">
      <h3>Histórico do plano</h3>
      {historyLoading && <p>Carregando histórico...</p>}
      <div className="automation-plan-list">
        {history.map((item) => (
          <article key={item.id}>
            <strong>{item.message}</strong>
            <span>{item.userName}</span>
            <time>{formatAutomationDate(item.createdAt)}</time>
          </article>
        ))}
      </div>
      {!historyLoading && !history.length && <p className="empty">Nenhum evento registrado.</p>}
    </section>
  );
}

// Painel das abas Agenda, Maquinas, Scripts e Historico (a aba Resumo e o overview).
export default function AutomationPlanTabPanel({ tab, plan, linkedScripts, history, historyLoading }) {
  if (tab === "agenda") return <AgendaPanel plan={plan} />;
  if (tab === "machines") return <MachinesPanel plan={plan} />;
  if (tab === "scripts") return <ScriptsPanel linkedScripts={linkedScripts} />;
  return <HistoryPanel history={history} historyLoading={historyLoading} />;
}
