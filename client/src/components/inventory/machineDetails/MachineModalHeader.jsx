import { Archive, Trash2, Wrench, X } from "lucide-react";
import AutomationIndicatorDots from "../../AutomationIndicatorDots.jsx";
import RemoteAssistanceAction from "../../remoteAssistance/RemoteAssistanceAction.jsx";

export default function MachineModalHeader({
  machine, alias, token, user, notify, eyebrow, inMaintenance, backupInUse,
  onPutMaintenance, onToggleBackup, onRemoveMachine, onClose
}) {
  return (
    <header className="asset-modal-header">
      <div>
        <span className="asset-eyebrow">{eyebrow}</span>
        <h2>{alias || machine.name}</h2>
        <p>{machine.name} - {machine.ip}</p>
        <AutomationIndicatorDots indicators={machine.automationIndicators} maxVisible={4} />
      </div>
      <div className="asset-modal-header-actions">
        <RemoteAssistanceAction
          asset={machine}
          alias={alias}
          token={token}
          user={user}
          notify={notify}
        />
        <button
          type="button"
          className={`ghost-action maintenance-action ${inMaintenance ? "active" : ""}`}
          onClick={onPutMaintenance}
          title={inMaintenance ? "Retirar da manutenção" : "Colocar em manutenção"}
        >
          <Wrench size={15} />
          {inMaintenance ? "Retirar da manutenção" : "Colocar em manutenção"}
        </button>
        <button
          type="button"
          className={`ghost-action backup-action ${machine?.isBackup ? "active" : ""}`}
          onClick={() => onToggleBackup?.(!machine?.isBackup)}
          disabled={backupInUse}
          title={backupInUse ? "Backup em uso por uma OS" : machine?.isBackup ? "Remover da área de Backup" : "Marcar como Backup"}
        >
          <Archive size={15} />
          {backupInUse ? "Backup em uso" : machine?.isBackup ? "Remover Backup" : "Marcar Backup"}
        </button>
        <button type="button" className="ghost-action danger-action" onClick={onRemoveMachine} title="Remover máquina do inventário">
          <Trash2 size={15} />
          Remover
        </button>
        <button type="button" className="icon-button" onClick={onClose} title="Fechar">
          <X size={18} />
        </button>
      </div>
    </header>
  );
}
