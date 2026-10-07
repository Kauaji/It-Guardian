import { useAlertCenterData } from "../../../context/AlertCenterContext.jsx";
import { alertTypeLabels, isDurationDisabled, isPercentThresholdRule, isThresholdDisabled, priorityLabels } from "../alertUtils.js";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";

const operationalWindowFields = [
  { field: "rejectedAlertSilenceHours", label: "Ignorar aviso recusado por (horas)", min: "1", unit: "H" },
  { field: "recurrenceCounterResetHours", label: "Resetar recorrência a cada (horas)", min: "1", unit: "H" },
  { field: "preventiveDueDays", label: "Preventiva vence em (dias)", min: "1", unit: "D" },
  { field: "inactiveAlertAutoResolveHours", label: "Remover aviso inativo após (horas)", min: "1", unit: "H" },
  { field: "scriptValidationWindowMinutes", label: "Validação de script (minutos)", min: "5", max: "10080", unit: "M" }
];

function OperationalWindows({ settings }) {
  const { perms } = useAlertCenterView();

  return (
    <div className="alert-settings-control-grid">
      {operationalWindowFields.map(({ field, label, min, max, unit }) => (
        <label key={field}>
          {label}
          <span className="input-with-unit">
            <input
              type="number"
              min={min}
              max={max}
              value={settings.priorityDraft[field]}
              disabled={!perms.canConfigureAlerts}
              onChange={(event) => settings.updateOperationalDraft(field, event.target.value)}
            />
            <em>{unit}</em>
          </span>
        </label>
      ))}
      <button
        type="button"
        className="secondary-action compact-action"
        disabled={!perms.canConfigureAlerts || settings.prioritySaving}
        onClick={settings.save}
      >
        {settings.prioritySaving ? "Salvando..." : "Salvar janelas"}
      </button>
    </div>
  );
}

function RuleRow({ rule, disabled, onUpdate }) {
  const thresholdOff = isThresholdDisabled(rule);
  const durationOff = isDurationDisabled(rule);

  return (
    <div className="settings-table-row alert-rule-row">
      <span>{alertTypeLabels[rule.type] || rule.type}</span>
      <span>
        <label className={`input-with-unit ${thresholdOff ? "disabled" : ""}`}>
          <input
            type="number"
            min="0"
            value={thresholdOff ? "" : (rule.threshold ?? "")}
            disabled={disabled || thresholdOff}
            onChange={(event) => onUpdate(rule.id, { threshold: event.target.value })}
          />
          {isPercentThresholdRule(rule) && !thresholdOff && <em>%</em>}
        </label>
      </span>
      <span>
        <label className={`input-with-unit ${durationOff ? "disabled" : ""}`}>
          <input
            type="number"
            min="0"
            value={durationOff ? "" : rule.durationMinutes}
            disabled={disabled || durationOff}
            onChange={(event) => onUpdate(rule.id, { durationMinutes: event.target.value })}
          />
          {!durationOff && <em>M</em>}
        </label>
      </span>
      <span>
        <label className="input-with-unit">
          <input
            type="number"
            min="1"
            value={rule.recurrenceCount}
            disabled={disabled}
            onChange={(event) => onUpdate(rule.id, { recurrenceCount: event.target.value })}
          />
          <em>x</em>
        </label>
      </span>
      <span>
        <select
          aria-label="Janela de recorrência"
          value={rule.recurrenceWindow}
          disabled={disabled}
          onChange={(event) => onUpdate(rule.id, { recurrenceWindow: event.target.value })}
        >
          <option value="same_day">Mesmo dia</option>
          <option value="last_24h">Últimas 24 horas</option>
          <option value="custom">Período configurável</option>
        </select>
      </span>
      <span>
        <select
          aria-label="Prioridade sugerida"
          value={rule.suggestedPriority || "medium"}
          disabled={disabled}
          onChange={(event) => onUpdate(rule.id, { suggestedPriority: event.target.value })}
        >
          {Object.entries(priorityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </span>
      <span>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={rule.enabled}
            disabled={disabled}
            onChange={(event) => onUpdate(rule.id, { enabled: event.target.checked })}
          />
          Ativa
        </label>
      </span>
    </div>
  );
}

// Secao "Regras de aviso": janelas operacionais e tabela de regras de recorrencia.
export default function AlertRulesSection({ settings }) {
  const { perms } = useAlertCenterView();
  const { rules, onUpdateRule } = useAlertCenterData();

  return (
    <section className="panel alert-settings-section">
      <OperationalWindows settings={settings} />
      <div className="settings-table alert-rules-table">
        <div className="settings-table-head">
          <span>Tipo</span>
          <span>Limite</span>
          <span>Tempo mínimo</span>
          <span>Recorrência</span>
          <span>Janela</span>
          <span>Prioridade da OS</span>
          <span>Status</span>
        </div>
        {rules.map((rule) => (
          <RuleRow key={rule.id} rule={rule} disabled={!perms.canConfigureAlerts} onUpdate={onUpdateRule} />
        ))}
      </div>
    </section>
  );
}
