import AutomationIndicatorDots from "../../AutomationIndicatorDots.jsx";
import { formatDate } from "../../../utils/display.js";
import { formatDisplayText, getDeviceDisplayName } from "../alertUtils.js";
import { getPreventiveRowView } from "../preventiveUtils.js";

// Linha de uma maquina na etapa 1: status preventivo, ultima preventiva e indicadores de automacao.
export default function PreventiveDeviceRow({ item, dueDays, selected, disabled, onToggle }) {
  const { device, badges, daysSinceLastPreventive } = item;
  const { lastPreventive, nextPreventiveLabel, hasPreventiveError } = getPreventiveRowView(item, dueDays);

  return (
    <button
      type="button"
      className={[
        "preventive-device-row",
        selected ? "selected" : "",
        hasPreventiveError ? "has-error" : ""
      ].filter(Boolean).join(" ")}
      disabled={disabled}
      onClick={() => onToggle(device.id)}
    >
      <span className="preventive-device-check" aria-hidden="true">
        {selected ? "✓" : ""}
      </span>
      <span>
        <strong>{getDeviceDisplayName(device)}</strong>
        <small>
          {formatDisplayText(device.type || device.assetType, "Ativo")} •{" "}
          {formatDisplayText(device.statusLabel || device.status, "Sem status")}
        </small>
      </span>
      <em>
        {lastPreventive ? `Última preventiva: ${formatDate(lastPreventive.preparedAt || lastPreventive.createdAt)}` : "Sem preventiva registrada"}
      </em>
      {lastPreventive?.name && <small className="preventive-plan-used">Plano: {lastPreventive.name}</small>}
      <small className="preventive-next-date">
        {daysSinceLastPreventive !== null ? `${daysSinceLastPreventive} dia(s) desde a última • ` : ""}
        {nextPreventiveLabel}
      </small>
      <AutomationIndicatorDots
        indicators={device.automationIndicators}
        compact
        maxVisible={4}
        interactive={false}
      />
      <span className="preventive-device-badges">
        {badges.map((badge) => (
          <span key={`${device.id}-${badge.label}`} className={`pill ${badge.tone}`}>{badge.label}</span>
        ))}
      </span>
    </button>
  );
}
