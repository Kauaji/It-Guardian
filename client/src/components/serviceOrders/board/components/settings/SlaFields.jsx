import { priorityLabels } from "../../../serviceOrderBoardUtils.js";

// Prazo por prioridade, alerta de proximidade do vencimento e exigencia de checklist.
export default function SlaFields({ settings, updateField, updateSetting }) {
  const { sla } = settings;
  return (
    <div className="service-order-number-settings">
      {Object.entries(priorityLabels).map(([priority, label]) => (
        <label key={priority}>
          {label} (horas)
          <input type="number" min="1" value={sla[priority]} onChange={(event) => updateField("sla", priority, event.target.value)} />
        </label>
      ))}
      <label>
        Alerta de "próxima do vencimento" (% do prazo restante)
        <input
          type="number"
          min="1"
          max="100"
          value={sla.nearDuePercent}
          onChange={(event) => updateField("sla", "nearDuePercent", event.target.value)}
        />
      </label>
      <label>
        Ou quando restarem menos de (horas)
        <input
          type="number"
          min="1"
          value={sla.nearDueMinHours}
          onChange={(event) => updateField("sla", "nearDueMinHours", event.target.value)}
        />
      </label>
      <label className="settings-inline-check">
        <input
          type="checkbox"
          checked={Boolean(settings.requireChecklistBeforeFinish)}
          onChange={(event) => updateSetting("requireChecklistBeforeFinish", event.target.checked)}
        />
        Exigir checklist técnico completo para finalizar a OS
      </label>
    </div>
  );
}
