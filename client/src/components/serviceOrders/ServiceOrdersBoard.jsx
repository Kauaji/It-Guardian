import { useMemo } from "react";
import BoardHeader from "./board/components/BoardHeader.jsx";
import BoardModals from "./board/components/BoardModals.jsx";
import BoardSummary from "./board/components/BoardSummary.jsx";
import KanbanBoard from "./board/components/KanbanBoard.jsx";
import SettingsModal from "./board/components/settings/SettingsModal.jsx";
import { useBoardLookups } from "./board/hooks/useBoardLookups.js";
import { useBoardPanels } from "./board/hooks/useBoardPanels.js";
import { useMonthPicker } from "./board/hooks/useMonthPicker.js";
import { useOrderDragAndDrop } from "./board/hooks/useOrderDragAndDrop.js";
import { useServiceOrderFilters } from "./board/hooks/useServiceOrderFilters.js";
import { useServiceOrderSettings } from "./board/hooks/useServiceOrderSettings.js";
import { useSettingsModal } from "./board/hooks/useSettingsModal.js";

export default function ServiceOrdersBoard({
  serviceOrders = [],
  devices = [],
  segments = [],
  groups = [],
  tabs = [],
  activeTab,
  token,
  notify,
  systemMode = "local",
  saving,
  onCreate,
  onUpdate,
  onAddHistory,
  onStatusChange,
  onDelete,
  onSelectBackup,
  onReleaseBackup,
  onReopen,
  onOpenCalendar,
  permissions = {},
  user = null,
  remoteScriptExecutionEnabled = false
}) {
  const businessMode = systemMode === "business";
  const canChangeStatus = permissions.changeStatus ?? true;
  const can = {
    createOrders: permissions.create ?? true,
    manageSettings: permissions.settings ?? true
  };
  const canFinishOrders = permissions.finish ?? canChangeStatus;
  const canViewAllSectors = permissions.viewAll ?? false;
  const canViewAllClients = permissions.viewAll ?? false;
  const canChangeSector = permissions.changeSector ?? permissions.edit ?? false;
  const assetById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);

  const panels = useBoardPanels();
  const editor = useServiceOrderSettings({ token, notify, serviceOrders });
  const { availableSectors, clients, technicians } = useBoardLookups({ token, businessMode });
  const { configuredStatuses, finalStatusIds, serviceOrderSettings, priorityColors } = editor;
  const filtering = useServiceOrderFilters({
    serviceOrders,
    assetById,
    finalStatusIds,
    businessMode,
    canViewAllSectors,
    canViewAllClients,
    user
  });
  const picker = useMonthPicker({ serviceOrders, monthFilter: filtering.monthFilter });
  const settingsModal = useSettingsModal({
    settingsOpen: panels.settingsOpen,
    setSettingsOpen: panels.setSettingsOpen,
    setFiltersOpen: panels.setFiltersOpen,
    businessMode
  });
  const dnd = useOrderDragAndDrop({ serviceOrders, configuredStatuses, canChangeStatus, canFinishOrders, notify, onStatusChange });

  return (
    <section className="service-orders-view">
      <BoardHeader
        businessMode={businessMode}
        can={can}
        panels={panels}
        search={{ value: filtering.orderSearch, onChange: filtering.setOrderSearch }}
        month={{
          monthFilter: filtering.monthFilter,
          picker,
          onSelectMonth: (value) => {
            filtering.setMonthFilter(value);
            panels.setMonthPickerOpen(false);
          },
          onClearMonth: () => {
            filtering.setMonthFilter("");
            panels.setMonthPickerOpen(false);
          },
          onClose: () => panels.setMonthPickerOpen(false)
        }}
        filtersProps={{
          filters: filtering.filters,
          setters: filtering.setters,
          businessMode,
          canViewAllClients,
          canViewAllSectors,
          clients,
          technicians,
          availableSectors,
          configuredStatuses
        }}
      />

      {panels.settingsOpen && (
        <SettingsModal
          modal={settingsModal}
          editor={editor}
          token={token}
          notify={notify}
          systemMode={systemMode}
          onClose={() => panels.setSettingsOpen(false)}
        />
      )}

      <BoardSummary configuredStatuses={configuredStatuses} visibleServiceOrders={filtering.visibleServiceOrders} />

      <KanbanBoard
        layout={serviceOrderSettings.boardLayout}
        configuredStatuses={configuredStatuses}
        visibleServiceOrders={filtering.visibleServiceOrders}
        dnd={dnd}
        assetById={assetById}
        priorityColors={priorityColors}
        businessMode={businessMode}
        onOpen={panels.setSelectedOrder}
      />

      <BoardModals
        panels={panels}
        serviceOrders={serviceOrders}
        devices={devices}
        segments={segments}
        groups={groups}
        tabs={tabs}
        activeTab={activeTab}
        token={token}
        user={user}
        notify={notify}
        systemMode={systemMode}
        saving={saving}
        serviceOrderSettings={serviceOrderSettings}
        availableSectors={availableSectors}
        configuredStatuses={configuredStatuses}
        permissions={permissions}
        canChangeSector={canChangeSector}
        remoteScriptExecutionEnabled={remoteScriptExecutionEnabled}
        handlers={{ onCreate, onUpdate, onAddHistory, onStatusChange, onDelete, onSelectBackup, onReleaseBackup, onReopen, onOpenCalendar }}
      />
    </section>
  );
}
