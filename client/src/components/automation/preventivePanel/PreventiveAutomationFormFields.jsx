import PreventiveAutomationColorField from "./PreventiveAutomationColorField.jsx";
import PreventiveAutomationScopeFields from "./PreventiveAutomationScopeFields.jsx";
import {
  preventiveAutomationRecurrenceLabels,
  preventiveAutomationTimezoneOptions
} from "./preventiveAutomationPanelUtils.js";

export default function PreventiveAutomationFormFields({ form, plans, identity, scopeSources, onChange }) {
  return (
    <div className="preventive-automation-form-grid">
      <label>
        Nome
        <input value={form.name} onChange={(event) => onChange("name", event.target.value)} required />
        {identity.duplicateNamePlan && (
          <span className="form-error">Já existe uma automatização com esse nome.</span>
        )}
      </label>
      <label>
        Recorrência
        <select value={form.recurrenceType} onChange={(event) => onChange("recurrenceType", event.target.value)}>
          {Object.entries(preventiveAutomationRecurrenceLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      {form.recurrenceType === "custom_days" && (
        <label>
          Repetir a cada (dias)
          <input
            type="number"
            min="1"
            max="365"
            value={form.recurrenceInterval}
            onChange={(event) => onChange("recurrenceInterval", event.target.value)}
            required
          />
        </label>
      )}
      <label>
        Horário preferencial
        <input type="time" value={form.preferredTime} onChange={(event) => onChange("preferredTime", event.target.value)} />
      </label>
      <label>
        Fuso horário
        <select value={form.timezone} onChange={(event) => onChange("timezone", event.target.value)}>
          {preventiveAutomationTimezoneOptions.map((timezone) => (
            <option key={timezone} value={timezone}>
              {timezone}
            </option>
          ))}
        </select>
      </label>
      <PreventiveAutomationColorField
        form={form}
        plans={plans}
        duplicateColorPlan={identity.duplicateColorPlan}
        onChange={(value) => onChange("indicatorColor", value)}
      />
      <PreventiveAutomationScopeFields form={form} scopeSources={scopeSources} onChange={onChange} />
      <label className="preventive-automation-wide">
        Descrição
        <textarea value={form.description} onChange={(event) => onChange("description", event.target.value)} />
      </label>
    </div>
  );
}
