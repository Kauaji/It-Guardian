import { useMemo } from "react";
import { useModalLifecycle } from "../../hooks/useModalLifecycle.js";
import DetailsHeader from "./details/components/DetailsHeader.jsx";
import DetailsTabBar from "./details/components/DetailsTabBar.jsx";
import DetailsTabPanels from "./details/components/DetailsTabPanels.jsx";
import PrintFinancialSection from "./details/components/PrintFinancialSection.jsx";
import { useAssetLinkWizard } from "./details/hooks/useAssetLinkWizard.js";
import { useDetailCatalogs } from "./details/hooks/useDetailCatalogs.js";
import { useDetailsTabs } from "./details/hooks/useDetailsTabs.js";
import { useOrderAssets } from "./details/hooks/useOrderAssets.js";
import { usePartsEditor } from "./details/hooks/usePartsEditor.js";
import { useServiceOrderActions } from "./details/hooks/useServiceOrderActions.js";
import { useServiceOrderDraft } from "./details/hooks/useServiceOrderDraft.js";
import { useServiceSelector } from "./details/hooks/useServiceSelector.js";
import { buildAvailableSectors, buildStatusLabelMap, buildStatusOptions } from "./details/utils/orderLookups.js";
import { buildDetailPermissions } from "./details/utils/permissions.js";

export default function ServiceOrderDetailsModal({
  serviceOrder,
  devices = [],
  segments = [],
  groups = [],
  tabs: inventoryTabs = [],
  token,
  user,
  notify,
  systemMode = "local",
  statuses = [],
  sectors = [],
  saving,
  onClose,
  onUpdate,
  onStatusChange,
  onDelete,
  onSelectBackup,
  onReleaseBackup,
  onReopen,
  onOpenCalendar,
  permissions = {},
  canChangeSector = false,
  remoteScriptExecutionEnabled = false
}) {
  const businessMode = systemMode === "business";
  const environmentLabel = businessMode ? "Cliente" : "Ambiente";
  const can = buildDetailPermissions(permissions);
  const { activeTab, setActiveTab } = useDetailsTabs(serviceOrder);
  const { technicians, products, services } = useDetailCatalogs({ serviceOrder, token, notify });
  const { draft, setDraft, updateDraft, serviceItems, serviceValueNumber, partsTotal, totalValue } = useServiceOrderDraft(serviceOrder);
  const finance = { serviceItems, serviceValueNumber, partsTotal, totalValue };
  const serviceSelector = useServiceSelector({ serviceOrder, services, businessMode, setDraft, updateDraft });
  const partsEditor = usePartsEditor({ serviceOrder, products, setDraft });
  const { asset, backupAsset, availableBackupDevices } = useOrderAssets({ serviceOrder, devices, token });
  const wizard = useAssetLinkWizard({ serviceOrder, devices, segments, groups, inventoryTabs, onUpdate });
  const statusOptions = useMemo(() => buildStatusOptions(statuses), [statuses]);
  const statusLabelMap = useMemo(() => buildStatusLabelMap(statusOptions), [statusOptions]);
  const availableSectors = useMemo(() => buildAvailableSectors(sectors), [sectors]);
  const actions = useServiceOrderActions({
    serviceOrder,
    draft,
    asset,
    businessMode,
    environmentLabel,
    statusLabelMap,
    availableSectors,
    finance,
    notify,
    onUpdate,
    onReopen,
    onDelete,
    onClose
  });
  const dialogRef = useModalLifecycle(Boolean(serviceOrder), onClose);

  if (!serviceOrder) return null;

  return (
    <div className="modal-backdrop asset-modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="asset-modal service-order-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes da OS"
      >
        <DetailsHeader
          serviceOrder={serviceOrder}
          asset={asset}
          token={token}
          user={user}
          notify={notify}
          saving={saving}
          reopening={actions.reopening}
          statusOptions={statusOptions}
          statusLabelMap={statusLabelMap}
          can={can}
          onReopen={actions.reopenOrder}
          onStatusChange={onStatusChange}
          onDelete={actions.deleteOrder}
          onPrint={actions.printServiceOrder}
          onClose={onClose}
        />

        <DetailsTabBar activeTab={activeTab} onSelect={setActiveTab} />

        <DetailsTabPanels
          activeTab={activeTab}
          serviceOrder={serviceOrder}
          asset={asset}
          backupAsset={backupAsset}
          availableBackupDevices={availableBackupDevices}
          statusLabelMap={statusLabelMap}
          availableSectors={availableSectors}
          businessMode={businessMode}
          environmentLabel={environmentLabel}
          inventoryTabs={inventoryTabs}
          canChangeSector={canChangeSector}
          saving={saving}
          can={can}
          token={token}
          notify={notify}
          remoteScriptExecutionEnabled={remoteScriptExecutionEnabled}
          attendance={{ draft, updateDraft, technicians, services, products, serviceSelector, partsEditor, finance }}
          wizard={wizard}
          actions={actions}
          onSelectBackup={onSelectBackup}
          onReleaseBackup={onReleaseBackup}
          onOpenCalendar={onOpenCalendar}
        />

        {Boolean(businessMode || serviceValueNumber || partsTotal || serviceItems.length) && <PrintFinancialSection {...finance} />}
      </section>
    </div>
  );
}
