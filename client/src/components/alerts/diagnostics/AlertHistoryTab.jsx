import { ClipboardList } from "lucide-react";
import { formatDate } from "../../../utils/display.js";
import { formatAlertValue, formatDisplayText, formatSuggestionCode } from "../alertUtils.js";
import { getSafeStatusLabel } from "../alertDisplayUtils.js";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";

// Aba de historico: avisos resolvidos e sugestoes aceitas ou recusadas.
export default function AlertHistoryTab({ resolvedAlerts, handledSuggestions }) {
  const { lookups } = useAlertCenterView();

  return (
    <section className="panel alerts-history-panel">
      <div className="panel-heading">
        <div>
          <h2>Histórico de avisos</h2>
          <p>Avisos resolvidos, sugestões aceitas e recusas registradas.</p>
        </div>
        <ClipboardList size={18} />
      </div>
      <div className="alert-board alert-history-board">
        {resolvedAlerts.map((alert) => (
          <article key={alert.id} className="alert-history-card">
            <span className="pill ok">Resolvido</span>
            <h3>{lookups.getResolvedAlertTitle(alert)}</h3>
            <p>{lookups.getAlertMachineLabel(alert)} · {formatAlertValue(alert)}</p>
            <small>{formatDate(alert.updatedAt || alert.resolvedAt || alert.startedAt)}</small>
          </article>
        ))}
        {handledSuggestions.map((suggestion, index) => (
          <article key={suggestion.id} className="alert-history-card">
            <span className={`pill ${suggestion.status === "accepted" ? "ok" : "danger"}`}>
              {getSafeStatusLabel(suggestion.status)}
            </span>
            <h3>{formatSuggestionCode(suggestion, index)} · {lookups.getResolvedSuggestionTitle(suggestion)}</h3>
            <p>{lookups.getResolvedSuggestionMachineLabel(suggestion)}</p>
            <small>
              {suggestion.createdServiceOrderId
                ? `OS criada: ${formatDisplayText(suggestion.createdServiceOrderId)}`
                : formatDisplayText(suggestion.rejectionReason, "Sem observação")}
            </small>
          </article>
        ))}
        {!resolvedAlerts.length && !handledSuggestions.length && (
          <p className="empty">Nenhum histórico encontrado ainda.</p>
        )}
      </div>
    </section>
  );
}
