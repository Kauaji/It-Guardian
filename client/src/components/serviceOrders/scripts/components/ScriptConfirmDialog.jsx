import { RISK_LABELS } from "../utils/scriptRules.js";

function ConfirmDetails({ script, mode, machineName }) {
  return (
    <dl>
      <dt>Script</dt>
      <dd>{script.name}</dd>
      <dt>Risco</dt>
      <dd>{RISK_LABELS[script.riskLevel] || script.riskLevel}</dd>
      <dt>Máquina alvo</dt>
      <dd>{machineName}</dd>
      {mode === "execute" && (
        <>
          <dt>Timeout</dt>
          <dd>até 600s</dd>
          <dt>Requer administrador</dt>
          <dd>{script.requiresAdmin ? "Sim" : "Não"}</dd>
          <dt>Requer usuário logado</dt>
          <dd>{script.requiresLoggedUser ? "Sim" : "Não"}</dd>
        </>
      )}
    </dl>
  );
}

export default function ScriptConfirmDialog({ confirmation, machineName }) {
  const { confirmingScript, confirmMode, queueing, confirmDialogRef, cancel, cancelUnlessQueueing, confirm } = confirmation;
  const simulate = confirmMode === "simulate";
  return (
    <div className="modal-backdrop" role="presentation" onClick={cancelUnlessQueueing}>
      <section
        ref={confirmDialogRef}
        className="service-order-script-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={simulate ? "Confirmar simulação de script" : "Confirmar execução de script"}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{simulate ? "Confirmar simulação" : "Confirmar execução"}</h3>
        <ConfirmDetails script={confirmingScript} mode={confirmMode} machineName={machineName} />
        <p>
          {simulate
            ? "Nenhum comando será executado. Esta ação apenas registra a intenção de uso do script no histórico da OS, no prontuário do ativo e nos logs de auditoria."
            : "Este script será executado na máquina selecionada pelo agente IT Guardian. A execução será registrada no histórico da OS, no prontuário do ativo e nos logs de auditoria."}
        </p>
        <div className="service-order-script-confirm-actions">
          <button type="button" className="ghost-action compact-action" onClick={cancel} disabled={queueing}>
            Cancelar
          </button>
          <button type="button" className="primary-action compact-action" disabled={queueing} onClick={confirm}>
            {queueing ? "Enviando..." : simulate ? "Confirmar simulação" : "Confirmar execução"}
          </button>
        </div>
      </section>
    </div>
  );
}
