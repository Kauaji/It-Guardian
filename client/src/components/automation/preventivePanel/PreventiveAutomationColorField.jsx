import { isColorUsedByOtherPlan, normalizeAutomationColor, preventiveAutomationColorOptions } from "./preventiveAutomationPanelUtils.js";

export default function PreventiveAutomationColorField({ form, plans, duplicateColorPlan, onChange }) {
  const currentColor = normalizeAutomationColor(form.indicatorColor);

  return (
    <label className="automation-color-field">
      Cor de identificação do plano
      <div>
        <span className="automation-color-dot" style={{ background: currentColor }} />
        <input type="color" value={currentColor} onChange={(event) => onChange(event.target.value)} aria-label="Escolher cor do plano" />
        <input
          value={form.indicatorColor}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onChange(normalizeAutomationColor(event.target.value))}
          aria-label="Valor hexadecimal da cor"
        />
      </div>
      {duplicateColorPlan && <span className="form-error">Essa cor já identifica a automatização "{duplicateColorPlan.name}".</span>}
      <div className="automation-color-palette" aria-label="Cores sugeridas">
        {preventiveAutomationColorOptions.map((color) => (
          <button
            key={color}
            type="button"
            className={currentColor === color ? "active" : ""}
            style={{ background: color }}
            onClick={() => onChange(color)}
            disabled={isColorUsedByOtherPlan(plans, form.id, color)}
            aria-label={`Usar cor ${color}`}
          />
        ))}
      </div>
    </label>
  );
}
