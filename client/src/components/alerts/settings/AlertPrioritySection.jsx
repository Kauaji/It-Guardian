import { Palette, RotateCcw } from "lucide-react";
import { priorityLabels } from "../alertUtils.js";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";

const autoPriorityFields = [
  ["lowToMediumHours", "Baixa para Média (horas)"],
  ["mediumToHighHours", "Média para Alta (horas)"],
  ["highToCriticalHours", "Alta para Crítica (horas)"]
];

function PriorityColors({ settings, disabled }) {
  return (
    <div className="service-order-priority-colors service-order-priority-colors-expanded">
      {Object.entries(priorityLabels).map(([priority, label]) => (
        <label key={priority}>
          <span className="service-order-color-swatch" style={{ background: settings.priorityDraft.priorityColors[priority] }} />
          {label}
          <input
            type="color"
            value={settings.priorityDraft.priorityColors[priority]}
            disabled={disabled}
            onChange={(event) => settings.changeColor(priority, event.target.value)}
            aria-label={`Cor da prioridade ${label}`}
          />
        </label>
      ))}
      <button
        type="button"
        className="ghost-action compact-action"
        disabled={disabled}
        onClick={settings.resetColors}
      >
        <RotateCcw size={15} />
        Padrão
      </button>
    </div>
  );
}

// Secao "Prioridade": tempos de escalonamento automatico e cores por prioridade.
export default function AlertPrioritySection({ settings }) {
  const { perms } = useAlertCenterView();
  const disabled = !perms.canConfigureAlerts;
  const { autoPriority } = settings.priorityDraft;

  return (
    <section className="panel alert-settings-section">
      <div className="service-order-number-settings alert-priority-settings">
        {autoPriorityFields.map(([field, label]) => (
          <label key={field}>
            {label}
            <input
              type="number"
              min="1"
              value={autoPriority[field]}
              disabled={disabled}
              onChange={(event) => settings.updatePriorityDraft("autoPriority", field, event.target.value)}
            />
          </label>
        ))}
        <label className="settings-inline-check service-order-priority-enabled">
          <input
            type="checkbox"
            checked={Boolean(autoPriority.enabled)}
            disabled={disabled}
            onChange={(event) => settings.updatePriorityDraft("autoPriority", "enabled", event.target.checked)}
          />
          Ativar mudança automática de prioridade
        </label>
        <button
          type="button"
          className="secondary-action compact-action alert-priority-color-toggle"
          disabled={disabled}
          onClick={settings.toggleColorsOpen}
        >
          <Palette size={15} />
          {settings.priorityColorsOpen ? "Ocultar cores" : "Cores"}
        </button>
        {settings.priorityColorsOpen && <PriorityColors settings={settings} disabled={disabled} />}
        <button
          type="button"
          className="primary-action compact-action alert-priority-save"
          disabled={disabled || settings.prioritySaving}
          onClick={settings.save}
        >
          <Palette size={15} />
          {settings.prioritySaving ? "Salvando..." : "Salvar prioridade"}
        </button>
      </div>
    </section>
  );
}
