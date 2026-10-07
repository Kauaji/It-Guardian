import { formatRisk, scriptTypeLabels } from "./scriptModel.js";
import SimulationForm from "./SimulationForm.jsx";

function formatVariable(variable) {
  return `{{${String(variable).replace(/[{}]/g, "")}}}`;
}

export default function ScriptCard({
  script,
  devices,
  serviceOrders,
  alerts,
  canManage,
  showSimulationForm,
  onEdit,
  onDeactivate,
  onRegisterSimulation
}) {
  return (
    <article className={`maintenance-script-card ${script.riskLevel}`}>
      <div className="script-card-header">
        <div>
          <h3>{script.name}</h3>
          <span>
            {scriptTypeLabels[script.type] || script.type} - {script.category || "Sem categoria"}
          </span>
        </div>
        <span className={`script-risk-pill ${script.riskLevel}`}>{formatRisk(script.riskLevel)}</span>
      </div>
      {script.description && <p>{script.description}</p>}
      <div className="script-card-summary">
        <strong>Resumo estimado</strong>
        <p>{script.estimatedSummary || "Resumo não informado."}</p>
        <small>Nenhum comando será executado por este módulo.</small>
      </div>
      <pre className="script-content-preview">{script.content}</pre>
      {(script.alertType || script.problemType) && (
        <div className="script-links">
          {script.alertType && <span>Aviso: {script.alertType}</span>}
          {script.problemType && <span>Problema: {script.problemType}</span>}
        </div>
      )}
      {!!script.tags?.length && (
        <div className="script-links">
          {script.tags.slice(0, 6).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      )}
      {!!script.supportedVariables?.length && (
        <div className="script-links">
          <span>Variáveis: {script.supportedVariables.map(formatVariable).join(", ")}</span>
        </div>
      )}
      {canManage && (
        <div className="script-card-actions">
          <button type="button" className="secondary-action compact-action" onClick={() => onEdit(script)}>
            Editar
          </button>
          <button type="button" className="danger-action compact-action" onClick={() => onDeactivate(script)}>
            Desativar
          </button>
        </div>
      )}
      {showSimulationForm && (
        <SimulationForm script={script} devices={devices} serviceOrders={serviceOrders} alerts={alerts} onRegister={onRegisterSimulation} />
      )}
    </article>
  );
}
