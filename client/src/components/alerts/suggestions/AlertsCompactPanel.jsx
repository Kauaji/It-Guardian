import { Bell } from "lucide-react";
import { useAlertCenterData } from "../../../context/AlertCenterContext.jsx";
import { alertTypeLabels, formatAlertValue, formatDisplayText } from "../alertUtils.js";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";

// Painel "Central de avisos": filtros e resumo dos avisos do historico.
export default function AlertsCompactPanel({ visibleAlerts }) {
  const { perms, lookups } = useAlertCenterView();
  const {
    severityFilter,
    setSeverityFilter,
    statusFilter,
    setStatusFilter,
    onEvaluateAlerts
  } = useAlertCenterData();

  return (
    <section className="panel alerts-compact-panel">
      <div className="panel-heading">
        <div>
          <h2>Central de avisos</h2>
          <p>Resumo dos avisos simulados.</p>
        </div>
        <Bell size={18} />
      </div>
      <div className="toolbar inline-toolbar">
        <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
          <option value="all">Todas</option>
          <option value="critical">Críticos</option>
          <option value="warning">Atenção</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="resolved">Resolvidos</option>
        </select>
        {perms.canManageSuggestions && (
          <button type="button" className="primary-action compact-action" onClick={onEvaluateAlerts}>
            Avaliar
          </button>
        )}
      </div>
      <div className="alert-board compact-alert-board">
        {visibleAlerts.map((alert) => (
          <article key={alert.id} className={`alert-card compact-alert-card ${alert.severity}`}>
            <div>
              <span className={`pill ${alert.status === "resolved" ? "ok" : "warning"}`}>
                {alert.status === "resolved" ? "Resolvido" : "Ativo"}
              </span>
              <span className={`pill ${alert.severity === "critical" ? "danger" : "warning"}`}>
                {alert.severity === "critical" ? "Crítico" : "Atenção"}
              </span>
            </div>
            <h3>{lookups.getResolvedAlertTitle(alert)}</h3>
            <p>{lookups.getAlertMachineLabel(alert)} · {formatAlertValue(alert)}</p>
            <small>{alertTypeLabels[alert.type] || formatDisplayText(alert.type || alert.metric, "Aviso")}</small>
          </article>
        ))}
        {!visibleAlerts.length && <p className="empty">Nenhum aviso encontrado para os filtros atuais.</p>}
      </div>
    </section>
  );
}
