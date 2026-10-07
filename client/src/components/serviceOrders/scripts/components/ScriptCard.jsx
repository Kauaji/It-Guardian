import { ClipboardCheck, PlayCircle } from "lucide-react";
import { RISK_LABELS } from "../utils/scriptRules.js";

export default function ScriptCard({ script, canRunReal, canRunSimulation, queueing, reason, onConfirm }) {
  return (
    <article className="service-order-script-card">
      <div>
        <strong>{script.name}</strong>
        <span className={`service-order-script-risk risk-${script.riskLevel}`}>{RISK_LABELS[script.riskLevel] || script.riskLevel}</span>
      </div>
      {script.recommendationReason && <p>{script.recommendationReason}</p>}
      {script.estimatedSummary && <p>{script.estimatedSummary}</p>}
      <div className="service-order-script-card-actions">
        <button
          type="button"
          className="primary-action compact-action"
          disabled={!canRunReal || queueing}
          onClick={() => onConfirm(script, "execute")}
          title={reason || undefined}
        >
          <PlayCircle size={14} />
          Executar no agente
        </button>
        {canRunSimulation && (
          <button
            type="button"
            className="ghost-action compact-action"
            disabled={queueing}
            onClick={() => onConfirm(script, "simulate")}
            title="Registra a intenção de uso do script sem enviar nada ao agente."
          >
            <ClipboardCheck size={14} />
            Registrar simulação
          </button>
        )}
      </div>
    </article>
  );
}
