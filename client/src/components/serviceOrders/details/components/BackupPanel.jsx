import { Archive, RotateCcw } from "lucide-react";
import { assetTypeLabel } from "../../../inventory/assetTypes.js";

function BackupContent({ asset, backupAsset, availableBackupDevices, saving, serviceOrder, onSelectBackup, onReleaseBackup }) {
  if (!asset) return <p className="empty">Vincule a máquina principal antes de selecionar um Backup.</p>;

  if (backupAsset) {
    return (
      <article className="service-order-linked-backup">
        <div>
          <strong>{backupAsset.name}</strong>
          <span>
            {backupAsset.ip || "Sem IP"} - {assetTypeLabel(backupAsset.assetType)} - {backupAsset.statusLabel || "Sem status"}
          </span>
        </div>
        <button type="button" className="ghost-action compact-action" disabled={saving} onClick={() => onReleaseBackup?.(serviceOrder)}>
          <RotateCcw size={15} />
          Devolver Backup
        </button>
      </article>
    );
  }

  if (!availableBackupDevices.length) return <p className="empty">Nenhuma máquina Backup disponível no momento.</p>;

  return (
    <div className="service-order-backup-card-list">
      {availableBackupDevices.map((device) => (
        <button key={device.id} type="button" disabled={saving} onClick={() => onSelectBackup?.(serviceOrder, device)}>
          <strong>{device.name}</strong>
          <span>
            {device.ip || "Sem IP"} - {assetTypeLabel(device.assetType)} - {device.statusLabel || "Sem status"}
          </span>
        </button>
      ))}
    </div>
  );
}

// Maquina Backup: vinculada (devolver), disponiveis (selecionar) ou orientacao.
export default function BackupPanel(props) {
  return (
    <section className="service-order-backup-panel">
      <header>
        <Archive size={18} />
        <div>
          <strong>Máquina Backup</strong>
          <span>Reserva temporária para substituir a máquina principal durante a manutenção.</span>
        </div>
      </header>
      <BackupContent {...props} />
    </section>
  );
}
