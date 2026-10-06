import { Plus } from "lucide-react";
import AssetLinkWizard from "./AssetLinkWizard.jsx";
import AssetSummary from "./AssetSummary.jsx";
import BackupPanel from "./BackupPanel.jsx";

// Aba Maquina: ficha do ativo (ou convite para vincular), backup e assistente de vinculo.
export default function AssetTab({
  serviceOrder,
  asset,
  backupAsset,
  availableBackupDevices,
  environmentLabel,
  inventoryTabs,
  wizard,
  saving,
  onSelectBackup,
  onReleaseBackup
}) {
  return (
    <section className="service-order-asset-panel">
      {asset ? (
        <AssetSummary asset={asset} serviceOrder={serviceOrder} environmentLabel={environmentLabel} />
      ) : (
        <div className="service-order-link-empty">
          <p className="empty">Nenhuma máquina ou ativo vinculado a esta OS.</p>
          <button type="button" className="secondary-action compact-action" onClick={wizard.toggleLinking}>
            <Plus size={16} />
            Vincular máquina
          </button>
        </div>
      )}

      <BackupPanel
        asset={asset}
        backupAsset={backupAsset}
        availableBackupDevices={availableBackupDevices}
        saving={saving}
        serviceOrder={serviceOrder}
        onSelectBackup={onSelectBackup}
        onReleaseBackup={onReleaseBackup}
      />

      {wizard.linking && <AssetLinkWizard wizard={wizard} inventoryTabs={inventoryTabs} />}
    </section>
  );
}
