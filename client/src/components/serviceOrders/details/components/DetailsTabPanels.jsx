import AssetTab from "./AssetTab.jsx";
import AttendanceTab from "./AttendanceTab.jsx";
import DetailsTabContent from "./DetailsTabContent.jsx";
import GeneralTab from "./GeneralTab.jsx";
import HistoryTab from "./HistoryTab.jsx";

/**
 * Corpo do modal de detalhes da OS: a aba ativa entre Geral, Atendimento, Maquina e Historico
 * mais as demais abas (SLA, agenda, checklist, scripts, anexos, avaliacao) via DetailsTabContent.
 */
export default function DetailsTabPanels({
  activeTab,
  serviceOrder,
  asset,
  backupAsset,
  availableBackupDevices,
  statusLabelMap,
  availableSectors,
  businessMode,
  environmentLabel,
  inventoryTabs,
  canChangeSector,
  saving,
  can,
  token,
  notify,
  remoteScriptExecutionEnabled,
  attendance,
  wizard,
  actions,
  onSelectBackup,
  onReleaseBackup,
  onOpenCalendar
}) {
  return (
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
          draft={attendance.draft}
          updateDraft={attendance.updateDraft}
          technicians={attendance.technicians}
          services={attendance.services}
          products={attendance.products}
          serviceSelector={attendance.serviceSelector}
          partsEditor={attendance.partsEditor}
          finance={attendance.finance}
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
  );
}
