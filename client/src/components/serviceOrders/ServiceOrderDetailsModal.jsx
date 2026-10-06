import { useMemo } from "react";
import { useModalLifecycle } from "../../hooks/useModalLifecycle.js";
import AssetTab from "./details/components/AssetTab.jsx";
import AttendanceTab from "./details/components/AttendanceTab.jsx";
import DetailsHeader from "./details/components/DetailsHeader.jsx";
import DetailsTabBar from "./details/components/DetailsTabBar.jsx";
import DetailsTabContent from "./details/components/DetailsTabContent.jsx";
import GeneralTab from "./details/components/GeneralTab.jsx";
import HistoryTab from "./details/components/HistoryTab.jsx";
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

        <div className="asset-modal-body">
          {activeTab === "general" && (
            <GeneralTab
              serviceOrder={serviceOrder}
              statusLabelMap={statusLabelMap}
              businessMode={businessMode}
              environmentLabel={environmentLabel}
              asset={asset}
              backupAsset={backupAsset}
              canChangeSector={canChangeSector}
              availableSectors={availableSectors}
              saving={saving}
              onChangeSector={actions.changeServiceOrderSector}
            />
          )}

          {activeTab === "attendance" && (
            <AttendanceTab
              draft={draft}
              updateDraft={updateDraft}
              technicians={technicians}
              services={services}
              products={products}
              serviceSelector={serviceSelector}
              partsEditor={partsEditor}
              finance={finance}
              businessMode={businessMode}
              saving={saving}
              canRegisterAttendance={can.attendance}
              onSubmit={actions.submitAttendance}
            />
          )}

          {activeTab === "asset" && (
            <AssetTab
              serviceOrder={serviceOrder}
              asset={asset}
              backupAsset={backupAsset}
              availableBackupDevices={availableBackupDevices}
              environmentLabel={environmentLabel}
              inventoryTabs={inventoryTabs}
              wizard={wizard}
              saving={saving}
              onSelectBackup={onSelectBackup}
              onReleaseBackup={onReleaseBackup}
            />
          )}

          {activeTab === "history" && <HistoryTab serviceOrder={serviceOrder} asset={asset} />}

          <DetailsTabContent
            activeTab={activeTab}
            serviceOrder={serviceOrder}
            asset={asset}
            token={token}
            notify={notify}
            can={can}
            onOpenCalendar={onOpenCalendar}
            remoteScriptExecutionEnabled={remoteScriptExecutionEnabled}
          />
        </div>

        {Boolean(businessMode || serviceValueNumber || partsTotal || serviceItems.length) && <PrintFinancialSection {...finance} />}
      </section>
    </div>
  );
}
