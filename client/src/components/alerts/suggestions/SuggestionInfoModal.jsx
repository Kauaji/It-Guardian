import { XCircle } from "lucide-react";
import { useModalLifecycle } from "../../../hooks/useModalLifecycle.js";
import { formatDisplayText, formatSuggestionCode, getAlertCategory } from "../alertUtils.js";
import { getSafeStatusLabel } from "../alertDisplayUtils.js";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";
import {
  AlertSection,
  ChecklistSection,
  CommentsSection,
  CorrelationSection,
  ExplanationsSection,
  MachineSection
} from "./SuggestionInfoSections.jsx";

function statusTone(status) {
  if (status === "accepted") return "ok";
  return status === "rejected" ? "danger" : "warning";
}

function InfoHeader({ suggestion, model, index, title, onClose }) {
  return (
    <header className="suggestion-info-header">
      <div>
        <span>{formatSuggestionCode(suggestion, index)}</span>
        <h2 id="suggestion-info-title">{title}</h2>
        <p>
          {model.machineLabel} - {model.location.groupName} - {model.location.segmentName}
        </p>
        <div className="suggestion-info-badges">
          <span className={`pill ${statusTone(suggestion.status)}`}>
            {getSafeStatusLabel(suggestion.status)}
          </span>
          <span className={`pill ${model.priority === "critical" ? "danger" : "warning"}`}>
            {model.priorityLabel}
          </span>
          <span className="pill">{formatDisplayText(suggestion.category, getAlertCategory(model.alert))}</span>
        </div>
      </div>
      <button
        type="button"
        className="icon-button"
        onClick={onClose}
        aria-label="Fechar detalhes do aviso"
        title="Fechar detalhes do aviso"
      >
        <XCircle size={18} />
      </button>
    </header>
  );
}

function InfoFooter({ suggestion, onAccept, onReject, onClose }) {
  const { perms } = useAlertCenterView();

  return (
    <footer className="suggestion-info-footer">
      {perms.canManageSuggestions && suggestion.status === "pending" && (
        <>
          <button
            type="button"
            className="primary-action compact-action"
            onClick={async () => {
              await onAccept(suggestion.id);
              onClose();
            }}
          >
            Criar OS
          </button>
          <button
            type="button"
            className="danger-action compact-action"
            onClick={async () => {
              await onReject(suggestion.id);
              onClose();
            }}
          >
            Recusar
          </button>
        </>
      )}
      <button type="button" className="secondary-action compact-action" onClick={onClose}>
        Fechar
      </button>
    </footer>
  );
}

// Modal de detalhes da sugestao: maquina, aviso, explicacoes, checklist,
// correlacoes e comentarios internos. `commentBox` vem de useAlertComments.
export default function SuggestionInfoModal({ suggestion, model, index, commentBox, onAccept, onReject, onClose }) {
  const { lookups } = useAlertCenterView();
  const dialogRef = useModalLifecycle(true, onClose);

  return (
    <div className="modal-backdrop suggestion-info-backdrop" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="modal-panel suggestion-info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggestion-info-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <InfoHeader
          suggestion={suggestion}
          model={model}
          index={index}
          title={lookups.getResolvedSuggestionTitle(suggestion)}
          onClose={onClose}
        />
        <div className="suggestion-info-body">
          <MachineSection suggestion={suggestion} model={model} />
          <AlertSection suggestion={suggestion} model={model} />
          <ExplanationsSection suggestion={suggestion} model={model} />
          <ChecklistSection checklist={model.checklist} />
          <CorrelationSection correlations={model.correlations} />
          <CommentsSection alertId={suggestion.alertId} comments={model.comments} commentBox={commentBox} />
        </div>
        <InfoFooter suggestion={suggestion} onAccept={onAccept} onReject={onReject} onClose={onClose} />
      </section>
    </div>
  );
}
