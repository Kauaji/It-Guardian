import { CalendarClock, Pause, Play, Search, Settings2 } from "lucide-react";
import { formatAutomationDate, formatRecurrence } from "./automationUtils.js";
import { automationPlanHasError, automationPlanWithoutSchedule } from "./automationStatusUtils.js";

function planMatchesStatus(plan, status) {
  if (status === "all") return true;
  if (status === "active") return plan.active !== false;
  if (status === "paused") return plan.active === false;
  if (status === "error") return automationPlanHasError(plan);
  if (status === "without_schedule") return automationPlanWithoutSchedule(plan);
  return true;
}

export default function AutomationPlansView({ plans = [], search, status, onSearch, onStatus, onOpenPlan }) {
  const visible = plans
    .filter((plan) => planMatchesStatus(plan, status))
    .filter((plan) => !search || `${plan.name} ${plan.description || ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  return (
    <section className="automation-plans-view" role="tabpanel">
      <div className="automation-management-toolbar">
        <label className="compact-search">
          <Search size={18} />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar plano" />
        </label>
        <select value={status} onChange={(event) => onStatus(event.target.value)} aria-label="Filtrar planos">
          <option value="all">Todos os planos</option>
          <option value="active">Ativos</option>
          <option value="paused">Pausados</option>
          <option value="error">Com erro</option>
          <option value="without_schedule">Sem próxima agenda</option>
        </select>
        <strong>{visible.length} plano(s)</strong>
      </div>
      <div className="automation-plan-grid">
        {visible.map((plan) => (
          <article key={plan.id} className="automation-plan-card" style={{ "--plan-color": plan.indicatorColor }}>
            <header>
              <div><i /><strong>{plan.name}</strong></div>
              <span className={plan.active === false ? "pill inactive" : "pill ok"}>
                {plan.active === false ? <Pause size={13} /> : <Play size={13} />}
                {plan.active === false ? "Pausado" : "Ativo"}
              </span>
            </header>
            <p>{plan.description || "Plano preventivo automatizado"}</p>
            <dl>
              <div><dt>Recorrência</dt><dd>{formatRecurrence(plan)}</dd></div>
              <div><dt>Máquinas</dt><dd>{plan.assetCount || 0}</dd></div>
              <div><dt>Scripts</dt><dd>{plan.scriptCount || 0}</dd></div>
              <div><dt>Próxima agenda</dt><dd>{formatAutomationDate(plan.nextRunAt, "Sem agenda")}</dd></div>
            </dl>
            <footer>
              <span><CalendarClock size={15} /> {plan.withoutScheduleCount || 0} sem agenda</span>
              <button type="button" className="secondary-action compact-action" onClick={() => onOpenPlan(plan)}>
                <Settings2 size={15} /> Gerenciar
              </button>
            </footer>
          </article>
        ))}
      </div>
      {!visible.length && <p className="empty">Nenhum plano encontrado para os filtros atuais.</p>}
    </section>
  );
}
