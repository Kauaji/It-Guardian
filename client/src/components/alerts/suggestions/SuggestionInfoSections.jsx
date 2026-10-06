import { formatDate } from "../../../utils/display.js";
import {
  alertTypeLabels,
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
import { getSafeCommentMessage, getSafeListItem, getSafeSummary } from "../alertDisplayUtils.js";
import AlertCommentBox from "../diagnostics/AlertCommentBox.jsx";

function InfoGrid({ items }) {
  return (
    <div className="suggestion-info-grid">
      {items.map(([label, value]) => (
        <div key={label} className="suggestion-info-item">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="suggestion-info-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function MachineSection({ suggestion, model }) {
  const { device, location } = model;

  return (
    <Section title="Informações da máquina">
      <InfoGrid
        items={[
          ["Nome", model.machineLabel],
          ["Tipo do ativo", formatDisplayText(device?.type || device?.manualAsset?.type || suggestion.category, "Não informado")],
          ["IP", formatDisplayText(device?.ip || device?.manualAsset?.ip, "Não informado")],
          ["Sistema operacional", formatDisplayText(device?.os || device?.manualAsset?.os, "Não informado")],
          ["Aba/Ambiente", formatDisplayText(device?.tabName || device?.environment, "Não informado")],
          ["Grupo", location.groupName],
          ["Segmento", location.segmentName],
          ["Backup", device?.isBackup ? "Sim" : "Não"],
          ["Em manutenção", device?.maintenanceActive || device?.maintenanceStatus === "active" ? "Sim" : "Não"]
        ]}
      />
    </Section>
  );
}

export function AlertSection({ suggestion, model }) {
  const { alert } = model;

  return (
    <Section title="Informações do aviso">
      <InfoGrid
        items={[
          ["Tipo", alertTypeLabels[alert.type] || formatDisplayText(alert.type, "Aviso preventivo")],
          ["Categoria", formatDisplayText(suggestion.category, getAlertCategory(alert))],
          ["Métrica", formatDisplayText(alert.metric, "Não informada")],
          ["Valor atual", formatAlertValue(alert)],
          ["Limite", formatAlertThreshold(alert)],
          ["Ocorrências", alert.occurrencesCount || 1],
          ["Primeira ocorrência", formatDate(alert.firstSeenAt)],
          ["Última ocorrência", formatDate(alert.lastSeenAt)],
          ["Confiança", formatDisplayText(suggestion.confidenceLevel, getAlertConfidence(alert))],
          ["Tendência", formatDisplayText(suggestion.trend, getAlertTrend(alert))],
          ["Score/Risco", Math.round(suggestion.recurrenceScore || 0) || "N/D"],
          ["Origem", "Sistema"]
        ]}
      />
    </Section>
  );
}

export function ExplanationsSection({ suggestion, model }) {
  const { alert } = model;

  return (
    <Section title="Explicações técnicas">
      <div className="suggestion-info-text-list">
        <p>
          <strong>Motivo da prioridade:</strong>{" "}
          {formatDisplayText(suggestion.priorityReason, "Prioridade definida pela regra atual do aviso.")}
        </p>
        <p>
          <strong>Impacto operacional:</strong> {formatDisplayText(suggestion.operationalImpact, getAlertImpact(alert))}
        </p>
        <p>
          <strong>Causa provável:</strong> {formatDisplayText(suggestion.probableCause, getAlertProbableCause(alert))}
        </p>
        <p>
          <strong>Ação recomendada:</strong> {formatDisplayText(suggestion.recommendedAction, getAlertRecommendedAction(alert))}
        </p>
        {suggestion.recurrenceInsight?.summary && (
          <p>
            <strong>Reincidência:</strong> {getSafeSummary(suggestion.recurrenceInsight)}
          </p>
        )}
        {suggestion.falsePositiveInsight?.summary && (
          <p>
            <strong>Possível falso positivo:</strong> {getSafeSummary(suggestion.falsePositiveInsight)}
          </p>
        )}
        {suggestion.capacityForecast?.summary && (
          <p>
            <strong>Capacidade/previsão:</strong> {getSafeSummary(suggestion.capacityForecast)}
          </p>
        )}
      </div>
    </Section>
  );
}

export function ChecklistSection({ checklist }) {
  return (
    <Section title="Checklist sugerido">
      {checklist.length > 0 ? (
        <ul className="suggestion-info-checklist">
          {checklist.map((item, itemIndex) => (
            <li key={`${itemIndex}-${getSafeListItem(item)}`}>{getSafeListItem(item)}</li>
          ))}
        </ul>
      ) : (
        <p className="suggestion-info-empty">Nenhum item de checklist cadastrado para este aviso.</p>
      )}
    </Section>
  );
}

export function CorrelationSection({ correlations }) {
  return (
    <Section title="Correlação">
      {correlations.length > 0 ? (
        <div className="suggestion-info-correlations">
          {correlations.map((correlation) => (
            <article key={correlation.correlationId || correlation.id}>
              <span>{formatDisplayText(correlation.confidenceLevel, "Média")} confiança</span>
              <strong>{formatDisplayText(correlation.correlationSummary, "Aviso correlacionado")}</strong>
              <small>{formatDisplayText(correlation.relatedHosts, "Sem máquinas relacionadas")}</small>
            </article>
          ))}
        </div>
      ) : (
        <p className="suggestion-info-empty">Nenhuma correlação encontrada para esta sugestão.</p>
      )}
    </Section>
  );
}

// `commentBox` = { canComment, drafts, onChange, onSubmit } (nulo oculta o formulario).
export function CommentsSection({ alertId, comments, commentBox }) {
  return (
    <Section title="Comentários internos">
      <div className="alert-comments suggestion-info-comments">
        {comments.map((comment) => (
          <p key={comment.id}>
            <span>
              {formatDisplayText(comment.userName, "Usuário")} - {formatDate(comment.createdAt)}
            </span>
            {getSafeCommentMessage(comment)}
          </p>
        ))}
        {!comments.length && <small>Nenhum comentário registrado.</small>}
        {commentBox.canComment && alertId && (
          <AlertCommentBox
            value={commentBox.drafts[alertId] || ""}
            onChange={(value) => commentBox.onChange(alertId, value)}
            onSubmit={() => commentBox.onSubmit(alertId)}
          />
        )}
      </div>
    </Section>
  );
}
