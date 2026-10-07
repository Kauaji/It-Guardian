import { ChevronDown } from "lucide-react";
import { formatDisplayText } from "../alertUtils.js";
import { getSafeScriptLabel } from "../alertDisplayUtils.js";

// Verificacao/script selecionavel da etapa 2, com descricao expansivel.
export default function PreventiveScriptOption({ script, selected, expanded, disabled, onToggle, onToggleDetails }) {
  const scriptDetails =
    script.description ||
    script.estimatedSummary ||
    script.recommendationReason ||
    script.category ||
    "Sem descrição cadastrada para este script.";

  return (
    <article className={`preventive-script-option ${selected ? "selected" : ""} ${expanded ? "expanded" : ""}`}>
      <button type="button" className="preventive-script-select" disabled={disabled} onClick={() => onToggle(script.id)}>
        <span className="preventive-device-check" aria-hidden="true">
          {selected ? "✓" : ""}
        </span>
        <span>
          <strong>{getSafeScriptLabel(script)}</strong>
          <small>{formatDisplayText(script.recommendationReason || script.estimatedSummary || script.category, "Script cadastrado")}</small>
        </span>
        <em>{formatDisplayText(script.riskLevel, "medio")}</em>
      </button>
      <button
        type="button"
        className="icon-button preventive-script-expand"
        onClick={() => onToggleDetails(script.id)}
        aria-expanded={expanded}
        aria-label={expanded ? "Recolher descrição do script" : "Expandir descrição do script"}
        title={expanded ? "Recolher descrição" : "Ver descrição"}
      >
        <ChevronDown size={16} />
      </button>
      {expanded && (
        <div className="preventive-script-details">
          <strong>O que faz</strong>
          <p>{scriptDetails}</p>
        </div>
      )}
    </article>
  );
}
