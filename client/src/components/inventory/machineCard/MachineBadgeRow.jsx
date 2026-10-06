import AutomationIndicatorDots from "../../AutomationIndicatorDots.jsx";
import PulseDot from "../../ui/PulseDot.jsx";
import StatusTooltip from "../StatusTooltip.jsx";
import { pulseTone, statusLabel, statusTone } from "./machineCardPresentation.js";

function StatusIndicator({ machine, isManualAsset, canManage, onRefreshPing, setActivePopoverId }) {
  if (!isManualAsset) {
    return <span className={`status-dot ${statusTone(machine.status)}`}>{statusLabel(machine.status)}</span>;
  }
  return (
    <button
      type="button"
      className={`status-dot status-action ${statusTone(machine.status)}`}
      disabled={!canManage}
      onClick={(event) => {
        event.stopPropagation();
        setActivePopoverId(null);
        onRefreshPing(machine);
      }}
      title="Atualizar ping"
    >
      {statusLabel(machine.status)}
    </button>
  );
}

export default function MachineBadgeRow({ machine, typeLabel, isManualAsset, isBackup, backupInUse, canManage, onRefreshPing, setActivePopoverId }) {
  return (
    <div className="machine-badge-row">
      <StatusTooltip status={machine.status} lastSeenAt={machine.lastSeenAt}>
        <PulseDot tone={pulseTone(machine.status)} title={statusLabel(machine.status)} />
        <StatusIndicator
          machine={machine}
          isManualAsset={isManualAsset}
          canManage={canManage}
          onRefreshPing={onRefreshPing}
          setActivePopoverId={setActivePopoverId}
        />
      </StatusTooltip>
      <span className="asset-type-badge">{typeLabel}</span>
      {isBackup && (
        <span className={`backup-badge ${backupInUse ? "in-use" : "available"}`}>
          {backupInUse ? "Backup em uso" : "Backup disponível"}
        </span>
      )}
      <AutomationIndicatorDots indicators={machine.automationIndicators} compact maxVisible={4} />
    </div>
  );
}
