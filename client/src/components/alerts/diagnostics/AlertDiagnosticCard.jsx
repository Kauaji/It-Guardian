import { formatDate } from "../../../utils/display.js";
import {
  formatAlertThreshold,
  formatAlertValue,
  formatDisplayText,
  getAlertCategory,
  getAlertConfidence,
  getAlertImpact,
  getAlertProbableCause,
  getAlertRecommendedAction,
  getAlertTrend
} from "../alertUtils.js";
import { getSafeCommentMessage, getSafeListItem, getSafeSummary, normalizeAlertLocation } from "../alertDisplayUtils.js";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";
import AlertCommentBox from "./AlertCommentBox.jsx";

function MetricsList({ alert }) {
  return (
    <dl>
      <div><dt>Valor atual</dt><dd>{formatAlertValue(alert)}</dd></div>
      <div><dt>Limite</dt><dd>{formatAlertThreshold(alert)}</dd></div>
      <div><dt>Ocorrências</dt><dd>{alert.occurrencesCount || 1}</dd></div>
      <div><dt>Confiança</dt><dd>{formatDisplayText(alert.confidenceLevel, getAlertConfidence(alert))}</dd></div>
      <div><dt>Tendência</dt><dd>{formatDisplayText(alert.trend, getAlertTrend(alert))}</dd></div>
      <div><dt>Score</dt><dd>{Math.round(alert.recurrenceScore || 0) || "N/D"}</dd></div>
    </dl>
  );
}

function AlertComments({ alert, comments, commentBox }) {
  return (
    <div className="alert-comments">
      <strong>Comentários internos</strong>
      {comments.slice(-2).map((comment) => (
        <p key={comment.id}>
          <span>{formatDisplayText(comment.userName, "Usuario")} · {formatDate(comment.createdAt)}</span>
          {getSafeCommentMessage(comment)}
        </p>
      ))}
      {!comments.length && <small>Nenhum comentário registrado.</small>}
      {commentBox.canComment && (
        <AlertCommentBox
          value={commentBox.drafts[alert.id] || ""}
          onChange={(value) => commentBox.onChange(alert.id, value)}
          onSubmit={() => commentBox.onSubmit(alert.id)}
        />
      )}
    </div>
  );
}

// Cartao de diagnostico de um aviso ativo (impacto, causa, acao e comentarios).
export default function AlertDiagnosticCard({ alert, commentBox }) {
  const { lookups } = useAlertCenterView();
  const location = normalizeAlertLocation(alert.location || lookups.getAlertLocation(alert));
  const comments = Array.isArray(alert.comments) ? alert.comments : [];
  const checklist = Array.isArray(alert.checklist) ? alert.checklist : [];

  return (
    <article className={`alert-diagnostic-card ${alert.severity}`}>
      <header>
        <div>
          <span>{formatDisplayText(alert.category, getAlertCategory(alert))}</span>
          <h3>{lookups.getResolvedAlertTitle(alert)}</h3>
          <small>{lookups.getAlertMachineLabel(alert)} · {location.groupName} · {location.segmentName}</small>
        </div>
        <span className={`pill ${alert.severity === "critical" ? "danger" : "warning"}`}>
          {alert.severity === "critical" ? "Crítico" : "Atenção"}
        </span>
      </header>
      <MetricsList alert={alert} />
      <p><strong>Motivo da prioridade:</strong> {formatDisplayText(alert.priorityReason, "Prioridade definida pela regra atual do aviso.")}</p>
      <p><strong>Impacto:</strong> {formatDisplayText(alert.operationalImpact, getAlertImpact(alert))}</p>
      <p><strong>Causa provável:</strong> {formatDisplayText(alert.probableCause, getAlertProbableCause(alert))}</p>
      <p><strong>Ação recomendada:</strong> {formatDisplayText(alert.recommendedAction, getAlertRecommendedAction(alert))}</p>
      {alert.recurrenceInsight && (
        <p><strong>Reincidência:</strong> {getSafeSummary(alert.recurrenceInsight)}</p>
      )}
      {alert.falsePositiveInsight && (
        <p><strong>Possível falso positivo:</strong> {getSafeSummary(alert.falsePositiveInsight)}</p>
      )}
      {alert.capacityForecast?.summary && (
        <p><strong>Capacidade:</strong> {getSafeSummary(alert.capacityForecast)}</p>
      )}
      {!!checklist.length && (
        <div className="alert-checklist">
          <strong>Checklist sugerido</strong>
          <ul>
            {checklist.slice(0, 4).map((item, itemIndex) => (
              <li key={`${itemIndex}-${getSafeListItem(item)}`}>{getSafeListItem(item)}</li>
            ))}
          </ul>
        </div>
      )}
      <AlertComments alert={alert} comments={comments} commentBox={commentBox} />
    </article>
  );
}
