import { Palette, RotateCcw } from "lucide-react";
import { priorityLabels } from "../../../serviceOrderBoardUtils.js";

const THRESHOLD_FIELDS = [
  ["lowToMediumHours", "Baixa para Média (horas)"],
  ["mediumToHighHours", "Média para Alta (horas)"],
  ["highToCriticalHours", "Alta para Crítica (horas)"]
];

function PriorityColorEditor({ priorityColors, changePriorityColor, resetPriorityColors }) {
  return (
    <div className="service-order-priority-colors service-order-priority-colors-expanded">
      {Object.entries(priorityLabels).map(([priority, label]) => (
        <label key={priority}>
          <span className="service-order-color-swatch" style={{ background: priorityColors[priority] }} />
          {label}
          <input
            type="color"
            value={priorityColors[priority]}
            onChange={(event) => changePriorityColor(priority, event.target.value)}
            aria-label={`Cor da prioridade ${label}`}
          />
        </label>
      ))}
      <button type="button" className="ghost-action compact-action" onClick={resetPriorityColors}>
        <RotateCcw size={15} />
        Padrão
      </button>
    </div>
  );
}

// Escalonamento automatico de prioridade por tempo em aberto e cores das prioridades.
export default function AutoPriorityFields({ editor, showPriorityColorConfig, onToggleColors }) {
  const { serviceOrderSettings, priorityColors, updateServiceOrderSettingsField } = editor;
  const { autoPriority } = serviceOrderSettings;
  return (
    <div className="service-order-number-settings">
      {THRESHOLD_FIELDS.map(([field, label]) => (
        <label key={field}>
          {label}
          <input
            type="number"
            min="1"
            value={autoPriority[field]}
            onChange={(event) => updateServiceOrderSettingsField("autoPriority", field, event.target.value)}
          />
        </label>
      ))}
      <button type="button" className="secondary-action compact-action service-order-priority-color-toggle" onClick={onToggleColors}>
        <Palette size={16} />
        Configurar cores das prioridades
      </button>
      {showPriorityColorConfig && (
        <PriorityColorEditor
          priorityColors={priorityColors}
          changePriorityColor={editor.changePriorityColor}
          resetPriorityColors={editor.resetPriorityColors}
        />
      )}
      <label className="settings-inline-check service-order-priority-enabled">
        <input
          type="checkbox"
          checked={Boolean(autoPriority.enabled)}
          onChange={(event) => updateServiceOrderSettingsField("autoPriority", "enabled", event.target.checked)}
        />
        Ativar prioridade automática
      </label>
    </div>
  );
}
