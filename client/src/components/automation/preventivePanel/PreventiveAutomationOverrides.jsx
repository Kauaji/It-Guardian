import { ChevronDown } from "lucide-react";
import {
  getDefaultRecurrenceInterval,
  getOverrideLabel,
  getScopeOptions,
  preventiveAutomationRecurrenceLabels
} from "./preventiveAutomationPanelUtils.js";

// Recorrencias personalizadas por segmento ou maquina (secao recolhivel do formulario).
export default function PreventiveAutomationOverrides({ formState, scopeSources }) {
  const { form, overrideDraft, setOverrideDraft, overridesOpen, toggleOverridesOpen, addOverride, removeOverride } = formState;

  return (
    <section className={`preventive-automation-overrides ${overridesOpen ? "open" : ""}`}>
      <button type="button" className="preventive-automation-overrides-trigger" onClick={toggleOverridesOpen} aria-expanded={overridesOpen}>
        <span>Recorrência personalizada</span>
        <ChevronDown size={16} />
      </button>
      {overridesOpen && (
        <div className="preventive-automation-overrides-body">
          <div className="preventive-automation-override-row">
            <select
              aria-label="Tipo de alvo da exceção"
              value={overrideDraft.targetType}
              onChange={(event) => setOverrideDraft((current) => ({ ...current, targetType: event.target.value, targetId: "" }))}
            >
              <option value="segment">Segmento</option>
              <option value="asset">Máquina</option>
            </select>
            <select
              aria-label="Alvo da exceção"
              value={overrideDraft.targetId}
              onChange={(event) => setOverrideDraft((current) => ({ ...current, targetId: event.target.value }))}
            >
              <option value="">Selecione</option>
              {getScopeOptions(overrideDraft.targetType, scopeSources).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Recorrência da exceção"
              value={overrideDraft.recurrenceType}
              onChange={(event) =>
                setOverrideDraft((current) => ({
                  ...current,
                  recurrenceType: event.target.value,
                  recurrenceInterval: getDefaultRecurrenceInterval(event.target.value)
                }))
              }
            >
              {Object.entries(preventiveAutomationRecurrenceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {overrideDraft.recurrenceType === "custom_days" && (
              <input
                type="number"
                min="1"
                max="365"
                value={overrideDraft.recurrenceInterval}
                onChange={(event) =>
                  setOverrideDraft((current) => ({
                    ...current,
                    recurrenceInterval: event.target.value
                  }))
                }
                aria-label="Dias da recorrência personalizada"
              />
            )}
            <button type="button" className="secondary-action compact-action" onClick={addOverride}>
              Adicionar
            </button>
          </div>
          <div className="preventive-automation-override-list">
            {(form.overrides || []).map((item, index) => (
              <span key={`${item.assetId || item.segmentId}-${index}`} className="pill">
                {getOverrideLabel(item, scopeSources)}
                <button type="button" onClick={() => removeOverride(index)} aria-label="Remover recorrência personalizada">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
