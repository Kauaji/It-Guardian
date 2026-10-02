import { AlertTriangle, CheckCircle, ClipboardList, Info, Plus, RefreshCw, Settings as SettingsIcon, XCircle } from "lucide-react";
import { formatDate } from "../../../utils/display.js";
import {
  canCreateServiceOrderFromSuggestion,
  canRejectSuggestion,
  canUseScriptOnSuggestion,
  formatDisplayText,
  formatSuggestionCode,
  getScriptValidationTooltip,
  priorityLabels
} from "../alertUtils.js";
import { normalizeAlertLocation } from "../alertDisplayUtils.js";
import { hasRemoteAssistanceAgent, isRemoteAssistanceAssetFresh } from "../../remoteAssistance/remoteAssistanceModel.js";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";
import SuggestionScriptMenu from "./SuggestionScriptMenu.jsx";

const successStatuses = ["observed_resolved", "execution_success", "validation_success"];
const warningStatuses = ["observed_persistent", "execution_failed", "insufficient_data", "validation_failed"];

function ValidationIndicator({ validation }) {
  const status = validation.status || "";
  let icon = <SettingsIcon size={13} />;
  if (successStatuses.includes(status)) icon = <CheckCircle size={13} />;
  else if (warningStatuses.includes(status)) icon = <AlertTriangle size={13} />;

  return (
    <span className={`suggestion-validation-indicator ${status}`} title={getScriptValidationTooltip(validation)}>
      {icon}
    </span>
  );
}

function SuggestionActions({ suggestion, validation, agentActive, scriptMenu, actions }) {
  const { perms } = useAlertCenterView();
  const canCreate = canCreateServiceOrderFromSuggestion(suggestion);
  const canReject = canRejectSuggestion(suggestion);
  const hasPendingScriptLog = Boolean(validation?.log?.attentionRequired && !validation.log.acknowledgedAt);

  return (
    <div className="suggestion-actions">
      {perms.canManageSuggestions && (canCreate || canReject) && (
        <>
          {canCreate && (
            <button
              type="button"
              className="primary-action compact-action suggestion-create-order-trigger"
              onClick={() => actions.onAccept(suggestion.id)}
              title="Criar Ordem de Serviço"
              aria-label="Criar Ordem de Serviço"
            >
              <Plus size={16} />
            </button>
          )}
          {canReject && (
            <button
              type="button"
              className="danger-action compact-action suggestion-reject-trigger"
              onClick={() => actions.onReject(suggestion.id)}
              title="Recusar"
              aria-label="Recusar"
            >
              <XCircle size={15} />
            </button>
          )}
        </>
      )}
      <button
        type="button"
        className="icon-button suggestion-info-trigger"
        title="Ver detalhes do aviso"
        aria-label="Ver detalhes do aviso"
        onClick={() => actions.onOpenInfo(suggestion.id)}
      >
        <Info size={15} />
      </button>
      {hasPendingScriptLog && perms.canViewScriptLogs && (
        <button
          type="button"
          className="icon-button suggestion-log-trigger"
          title="Ver log do script"
          aria-label="Ver log do script"
          onClick={() => actions.onOpenLog(validation)}
        >
          <AlertTriangle size={15} />
        </button>
      )}
      {perms.canManageSuggestions && canUseScriptOnSuggestion(suggestion) && perms.canViewScripts && (
        <SuggestionScriptMenu suggestion={suggestion} scriptMenu={scriptMenu} agentActive={agentActive} />
      )}
    </div>
  );
}

// Card de uma sugestao de OS (consolidada por maquina) com suas acoes.
// `actions` = { onAccept, onReject, onOpenInfo, onOpenLog }
export default function SuggestionCard({ suggestion, index, priorityColor, scriptMenu, actions }) {
  const { lookups } = useAlertCenterView();
  const machineLabel = lookups.getResolvedSuggestionMachineLabel(suggestion);
  const suggestionTitle = lookups.getResolvedSuggestionTitle(suggestion);
  const location = normalizeAlertLocation(suggestion.location || lookups.getSuggestionLocation(suggestion));
  const priority = suggestion.suggestedPriority || "medium";
  const priorityLabel = priorityLabels[priority] || priorityLabels.medium;
  const locationLabel = `${location.groupName} • ${location.segmentName}`;
  const occurrenceCount = Number(suggestion.occurrencesCount || 1);
  const validation = suggestion?.latestValidation || null;
  const device = lookups.findSuggestionDevice(suggestion);
  const agentActive = hasRemoteAssistanceAgent(device) && isRemoteAssistanceAssetFresh(device);

  return (
    <article
      className="service-order-card suggestion-card"
      style={{
        "--service-order-priority-color": priorityColor,
        "--service-order-priority-bg": `color-mix(in srgb, ${priorityColor} 32%, var(--surface))`
      }}
      title={formatDisplayText(suggestion.priorityReason || suggestionTitle, suggestionTitle)}
    >
      {occurrenceCount > 1 && (
        <span
          className="suggestion-recurrence-indicator"
          title={`Este aviso ocorreu ${occurrenceCount} vezes no período configurado.`}
        >
          <RefreshCw size={12} />
          {occurrenceCount}x
        </span>
      )}
      {validation && <ValidationIndicator validation={validation} />}
      <span>{formatSuggestionCode(suggestion, index)}</span>
      <strong title={suggestionTitle}>{suggestionTitle}</strong>
      <small title={machineLabel}>{machineLabel}</small>
      <small className="suggestion-card-location" title={locationLabel}>{locationLabel}</small>
      <div className="suggestion-card-badges">
        <em title={priorityLabel}>{priorityLabel}</em>
        <em title="Preventiva">Preventiva</em>
      </div>
      <footer>
        <ClipboardList size={14} />
        <span title="Sistema">Sistema</span>
        <time>{formatDate(suggestion.createdAt)}</time>
      </footer>
      <SuggestionActions
        suggestion={suggestion}
        validation={validation}
        agentActive={agentActive}
        scriptMenu={scriptMenu}
        actions={actions}
      />
    </article>
  );
}
