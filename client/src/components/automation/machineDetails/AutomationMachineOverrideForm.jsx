import { recurrenceLabels } from "../automationUtils.js";

function FieldError({ message }) {
  return message ? <small className="automation-field-error">{message}</small> : null;
}

// Formulario da recorrencia personalizada que vale somente para esta maquina.
export default function AutomationMachineOverrideForm({
  machine,
  draft,
  errors,
  hasCustomOverride,
  busy,
  onChange,
  onSubmit,
  onUseInherited,
  onCancel
}) {
  return (
    <form className="automation-override-form" onSubmit={onSubmit} noValidate>
      <h3>Configuração desta máquina</h3>
      <p>Esta recorrência substitui a configuração herdada apenas para {machine.assetName}.</p>
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
      <footer>
        {hasCustomOverride && (
          <button type="button" className="secondary-action compact-action" disabled={busy} onClick={onUseInherited}>
            Usar recorrência herdada
          </button>
        )}
        <button type="button" className="secondary-action compact-action" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="primary-action compact-action" disabled={busy}>Salvar recorrência</button>
      </footer>
    </form>
  );
}
