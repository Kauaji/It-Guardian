import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, RefreshCw } from "lucide-react";
import { formatAutomationDate, groupAutomationAgendaItems } from "./automationUtils.js";

function dayKey(value) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date(value));
}

export default function AutomationAgendaView({ plans = [], onLoad, onOpenPlan, status = "all", onStatus }) {
  const [data, setData] = useState({ items: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const onLoadRef = useRef(onLoad);

  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await onLoadRef.current({ status, limit: 300 }));
    } catch (loadError) {
      setError(loadError.message || "Não foi possível carregar a agenda.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => Object.entries(data.items.reduce((result, item) => {
    const key = dayKey(item.nextRunAt);
    if (!result[key]) result[key] = [];
    result[key].push(item);
    return result;
  }, {})), [data.items]);

  return (
    <section className="automation-agenda-view" role="tabpanel">
      <div className="automation-agenda-summary">
        <span>Hoje <strong>{data.summary?.today || 0}</strong></span>
        <span>Próximos 7 dias <strong>{data.summary?.nextSevenDays || 0}</strong></span>
        <span>Atrasadas <strong>{data.summary?.overdue || 0}</strong></span>
        <span>Sem agenda <strong>{data.summary?.withoutSchedule || 0}</strong></span>
        <span>Com erro <strong>{data.summary?.errors || 0}</strong></span>
      </div>
      <div className="automation-agenda-toolbar">
        <select value={status} onChange={(event) => onStatus?.(event.target.value)} aria-label="Filtrar agenda">
          <option value="all">Toda a agenda</option>
          <option value="active">Ativas</option>
          <option value="overdue">Atrasadas</option>
          <option value="error">Com erro</option>
          <option value="without_schedule">Sem agenda</option>
        </select>
        <button type="button" className="icon-button" onClick={load} aria-label="Atualizar agenda"><RefreshCw size={17} /></button>
      </div>
      {loading && <div className="automation-management-skeleton"><span /><span /><span /></div>}
      {error && <div className="automation-management-error"><p>{error}</p><button className="secondary-action compact-action" onClick={load}>Tentar novamente</button></div>}
      {!loading && !error && groups.map(([label, items]) => (
        <section key={label} className="automation-agenda-group">
          <header><CalendarClock size={17} /><strong>{label}</strong><span>{items.length}</span></header>
          <div className="automation-agenda-plan-groups">
            {groupAutomationAgendaItems(items).map((group) => (
              <section
                key={group.key}
                className="automation-agenda-plan-group"
                style={{ "--agenda-plan-color": group.indicatorColor }}
              >
                <header>
                  <i aria-hidden="true" />
                  <span>
                    <strong>{group.planName}</strong>
                    <small>{group.segmentName}</small>
                  </span>
                  <em>{group.items.length} {group.items.length === 1 ? "máquina" : "máquinas"}</em>
                </header>
                <div>
                  {group.items.map((item) => {
                    const plan = plans.find((candidate) => String(candidate.id) === String(item.planId));
                    return (
                      <button key={`${item.planId}:${item.assetId}`} type="button" onClick={() => plan && onOpenPlan(plan)}>
                        <span><strong>{item.assetName}</strong></span>
                        <em className={`agenda-status ${item.status}`}>{item.status === "error" && <AlertTriangle size={13} />}{item.status.replaceAll("_", " ")}</em>
                        <time>{formatAutomationDate(item.nextRunAt, "Sem data")}</time>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      ))}
      {!loading && !error && !groups.length && <p className="empty">Nenhum compromisso encontrado na agenda.</p>}
    </section>
  );
}
