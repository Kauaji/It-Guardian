import { useAlertCenterData } from "../../../context/AlertCenterContext.jsx";
import { formatDisplayText } from "../alertUtils.js";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";
import AlertDiagnosticCard from "./AlertDiagnosticCard.jsx";

function CorrelationsSection({ correlations }) {
  return (
    <section className="alert-correlations-section" aria-label="Avisos correlacionados">
      <header>
        <div>
          <h3>Avisos correlacionados</h3>
          <p>Padrões agrupados por tipo, grupo e segmento para apoiar a triagem.</p>
        </div>
      </header>
      <div className="alert-correlations-grid">
        {correlations.slice(0, 4).map((correlation) => (
          <article
            key={correlation.correlationId || correlation.id}
            className={`alert-correlation-card ${correlation.impactLevel === "critical" ? "critical" : "warning"}`}
          >
            <span>{formatDisplayText(correlation.confidenceLevel, "Média")} confiança</span>
            <strong>{formatDisplayText(correlation.correlationSummary, "Aviso correlacionado")}</strong>
            <small>{formatDisplayText(correlation.relatedHosts, "Sem máquinas relacionadas")}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

// Aba de diagnostico dos avisos ativos (impacto, evidencias e acao recomendada).
export default function AlertDiagnosticsTab({ visibleAlerts, alertCorrelations, commentBox }) {
  const { perms } = useAlertCenterView();
  const { onEvaluateAlerts } = useAlertCenterData();
  const activeAlerts = visibleAlerts.filter((alert) => alert.status !== "resolved");

  return (
    <section className="panel alerts-diagnostics-panel">
      <div className="panel-heading">
        <div>
          <h2>Avisos ativos</h2>
          <p>Diagnóstico preventivo com impacto, evidência e ação recomendada.</p>
        </div>
        {perms.canManageSuggestions && (
          <button type="button" className="primary-action compact-action" onClick={onEvaluateAlerts}>
            Avaliar recorrência
          </button>
        )}
      </div>
      {alertCorrelations.length > 0 && <CorrelationsSection correlations={alertCorrelations} />}
      <div className="alert-board alert-diagnostics-board">
        {activeAlerts.map((alert) => (
          <AlertDiagnosticCard key={alert.id} alert={alert} commentBox={commentBox} />
        ))}
        {!activeAlerts.length && <p className="empty">Nenhum aviso ativo encontrado para os filtros atuais.</p>}
      </div>
    </section>
  );
}
