import { Save } from "lucide-react";
import {
  automationColorOptions,
  automationTimezoneOptions
} from "../automationFormUtils.js";
import { recurrenceLabels } from "../automationUtils.js";

function FieldError({ message }) {
  return message ? <small className="automation-field-error">{message}</small> : null;
}

function ColorFieldset({ draft, error, onChange }) {
  return (
    <fieldset className="automation-plan-wide automation-color-field">
      <legend>Cor de identificação</legend>
      <div>
        {automationColorOptions.map((color) => (
          <button
            key={color}
            type="button"
            className={draft.indicatorColor === color ? "selected" : ""}
            style={{ backgroundColor: color }}
            onClick={() => onChange("indicatorColor", color)}
            aria-label={`Usar cor ${color}`}
          />
        ))}
        <input value={draft.indicatorColor} onChange={(event) => onChange("indicatorColor", event.target.value)} />
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}

function ScriptPicker({ scripts, draft, error, onToggle }) {
  return (
    <section className="automation-plan-script-picker">
      <h3>Scripts vinculados</h3>
      <div>
        {scripts.map((script) => (
          <label key={script.id}>
            <input type="checkbox" checked={draft.defaultScriptIds.includes(script.id)} onChange={() => onToggle(script.id)} />
            <span><strong>{script.name}</strong><small>{script.category || "Sem categoria"}</small></span>
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </section>
  );
}

// Formulario de edicao da configuracao geral do plano.
export default function AutomationPlanEditForm({ draft, errors, scripts, busy, onChange, onToggleScript, onSubmit, onCancel }) {
  return (
    <form className="automation-plan-edit-form" onSubmit={onSubmit} noValidate>
      <div className="automation-plan-edit-grid">
        <label>
          Nome
          <input value={draft.name} onChange={(event) => onChange("name", event.target.value)} />
          <FieldError message={errors.name} />
        </label>
        <label>
          Recorrência
          <select value={draft.recurrenceType} onChange={(event) => onChange("recurrenceType", event.target.value)}>
            {Object.entries(recurrenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <FieldError message={errors.recurrenceType} />
        </label>
        {draft.recurrenceType === "custom_days" && (
          <label>
            Dias
            <input type="number" min="1" max="365" value={draft.recurrenceIntervalDays} onChange={(event) => onChange("recurrenceIntervalDays", Number(event.target.value))} />
            <FieldError message={errors.recurrenceIntervalDays} />
          </label>
        )}
        <label>
          Horário
          <input type="time" value={draft.preferredTime} onChange={(event) => onChange("preferredTime", event.target.value)} />
          <FieldError message={errors.preferredTime} />
        </label>
        <label>
          Fuso horário
          <select value={draft.timezone} onChange={(event) => onChange("timezone", event.target.value)}>
            {automationTimezoneOptions.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
          </select>
          <FieldError message={errors.timezone} />
        </label>
        <label className="automation-plan-wide">Descrição<textarea value={draft.description} onChange={(event) => onChange("description", event.target.value)} /></label>
        <label className="automation-plan-wide">Observações<textarea value={draft.notes} onChange={(event) => onChange("notes", event.target.value)} /></label>
        <ColorFieldset draft={draft} error={errors.indicatorColor} onChange={onChange} />
      </div>
      <ScriptPicker scripts={scripts} draft={draft} error={errors.defaultScriptIds} onToggle={onToggleScript} />
      <footer>
        <button type="button" className="secondary-action compact-action" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="primary-action compact-action" disabled={busy}>
          <Save size={15} /> Salvar alterações
        </button>
      </footer>
    </form>
  );
}
