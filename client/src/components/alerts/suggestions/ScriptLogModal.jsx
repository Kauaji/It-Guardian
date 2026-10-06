import { XCircle } from "lucide-react";
import { useModalLifecycle } from "../../../hooks/useModalLifecycle.js";
import { formatDate } from "../../../utils/display.js";
import { formatDisplayText, scriptValidationLabels } from "../alertUtils.js";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";

function SummaryItem({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LogSummary({ log }) {
  return (
    <section className="script-log-summary">
      <SummaryItem label="Status" value={scriptValidationLabels[log.validationStatus] || formatDisplayText(log.status, "Registrado")} />
      <SummaryItem label="Erro detectado" value={log.errorDetected ? "Sim" : "Não"} />
      <SummaryItem label="Tipo de erro" value={formatDisplayText(log.errorType, "Não informado")} />
      <SummaryItem label="Categoria" value={formatDisplayText(log.errorCategory, "Não informada")} />
      <SummaryItem label="Severidade" value={formatDisplayText(log.errorSeverity, "Não informada")} />
      <SummaryItem label="Reconhecido" value={log.acknowledgedAt ? formatDate(log.acknowledgedAt) : "Pendente"} />
    </section>
  );
}

function LogActions({ scriptLog }) {
  return (
    <>
      <button type="button" className="primary-action compact-action" onClick={scriptLog.registerSuggestedSolution}>
        Registrar solução sugerida
      </button>
      <button type="button" className="secondary-action compact-action" onClick={scriptLog.registerCustomSolution}>
        Registrar solução própria
      </button>
      <button type="button" className="secondary-action compact-action" onClick={scriptLog.acknowledge}>
        Marcar como analisado
      </button>
      <button type="button" className="danger-action compact-action" onClick={scriptLog.cancelAnalysis}>
        Cancelar análise
      </button>
    </>
  );
}

// Modal com o log tecnico de um script e as acoes de acompanhamento.
// `scriptLog` vem de useScriptLogDialog.
export default function ScriptLogModal({ scriptLog }) {
  const { perms } = useAlertCenterView();
  const log = scriptLog.selectedScriptLog;
  const dialogRef = useModalLifecycle(true, scriptLog.close);
  const canResolve = perms.canResolveScriptLogs && !log.previewOnly;

  return (
    <div className="modal-backdrop suggestion-info-backdrop" onMouseDown={scriptLog.close}>
      <section
        ref={dialogRef}
        className="modal-panel script-log-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="script-log-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>LOG DE SCRIPT</span>
            <h2 id="script-log-modal-title">{formatDisplayText(log.scriptName, "Registro de script")}</h2>
            <p>{formatDisplayText(log.parsedSummary, "Registro preparado para observação segura.")}</p>
          </div>
          <button type="button" className="icon-button" onClick={scriptLog.close} aria-label="Fechar log">
            <XCircle size={18} />
          </button>
        </header>
        <div className="script-log-body">
          <LogSummary log={log} />
          <section>
            <h3>Causa provável</h3>
            <p>{formatDisplayText(log.probableCause, "Nenhuma causa específica foi identificada.")}</p>
          </section>
          <section>
            <h3>Solução sugerida</h3>
            <p>{formatDisplayText(log.suggestedSolution, "Revise o script, o acesso ao ativo e as permissões antes de qualquer execução futura.")}</p>
          </section>
          <section>
            <details className="script-log-details">
              <summary>Log técnico</summary>
              <pre className="script-log-raw">{formatDisplayText(log.rawLog, "Nenhum log de script disponível.")}</pre>
            </details>
          </section>
          {canResolve && (
            <label className="script-log-custom-solution">
              Solução própria
              <textarea
                value={scriptLog.customNotes}
                onChange={(event) => scriptLog.setCustomNotes(event.target.value)}
                placeholder="Descreva a correção que será registrada sem executar comandos."
              />
            </label>
          )}
        </div>
        <footer className="script-log-actions">
          {canResolve && <LogActions scriptLog={scriptLog} />}
          <button type="button" className="secondary-action compact-action" onClick={scriptLog.close}>
            Fechar
          </button>
        </footer>
      </section>
    </div>
  );
}
