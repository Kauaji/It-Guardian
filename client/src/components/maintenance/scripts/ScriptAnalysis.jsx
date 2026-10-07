import { formatRisk } from "./scriptModel.js";

export default function ScriptAnalysis({ analysis }) {
  if (!analysis) return null;

  return (
    <div className="script-analysis-box">
      <strong>Resumo estimado</strong>
      <p>{analysis.estimatedSummary}</p>
      <span className={`script-risk-pill ${analysis.suggestedRiskLevel}`}>Risco sugerido: {formatRisk(analysis.suggestedRiskLevel)}</span>
      {!!analysis.allowedVariables?.length && (
        <div className="script-variable-list">
          <strong>Variáveis permitidas</strong>
          <p>{analysis.allowedVariables.map((variable) => variable.name).join(", ")}</p>
        </div>
      )}
      {!!analysis.detectedVariables?.length && (
        <div className="script-variable-list">
          <strong>Variáveis usadas</strong>
          <p>{analysis.detectedVariables.join(", ")}</p>
        </div>
      )}
      {!!analysis.unknownVariables?.length && (
        <div className="script-variable-list error">
          <strong>Variáveis não permitidas</strong>
          <p>{analysis.unknownVariables.join(", ")}</p>
        </div>
      )}
      {!!analysis.detectedActions?.length && (
        <ul>
          {analysis.detectedActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      )}
      <small>{analysis.safetyWarnings?.join(" ")}</small>
    </div>
  );
}
