import ServiceOrderDetailsModal from "../../ServiceOrderDetailsModal.jsx";
import ServiceOrderFormModal from "../../ServiceOrderFormModal.jsx";

// Formulario de nova OS e detalhes da OS selecionada (sempre montados; cada um decide se aparece).
export default function BoardModals({
  panels,
  serviceOrders,
  devices,
  segments,
  groups,
  tabs,
  activeTab,
  token,
  user,
  notify,
  systemMode,
  saving,
  serviceOrderSettings,
  availableSectors,
  configuredStatuses,
  permissions,
  canChangeSector,
  remoteScriptExecutionEnabled,
  handlers
}) {
  const { selectedOrder, formOpen, setFormOpen, setSelectedOrder } = panels;
  const selectedOrderCurrent = selectedOrder
    ? serviceOrders.find((order) => order.id === selectedOrder.id) || selectedOrder
    : null;

  return (
    <>
      <ServiceOrderFormModal
        open={formOpen}
        devices={devices}
        tabs={tabs}
        activeTab={activeTab}
        token={token}
        user={user}
        notify={notify}
        systemMode={systemMode}
        serviceOrderSettings={serviceOrderSettings}
        sectors={availableSectors}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSubmit={async (payload) => {
          const created = await handlers.onCreate(payload);
          if (created) setFormOpen(false);
        }}
      />

      <ServiceOrderDetailsModal
        serviceOrder={selectedOrderCurrent}
        devices={devices}
        segments={segments}
        groups={groups}
        tabs={tabs}
        token={token}
        user={user}
        notify={notify}
        systemMode={systemMode}
        statuses={configuredStatuses}
        sectors={availableSectors}
        saving={saving}
        onClose={() => setSelectedOrder(null)}
        onUpdate={handlers.onUpdate}
        onAddHistory={handlers.onAddHistory}
        onStatusChange={handlers.onStatusChange}
        onDelete={handlers.onDelete}
        onSelectBackup={handlers.onSelectBackup}
        onReleaseBackup={handlers.onReleaseBackup}
        onReopen={handlers.onReopen}
        onOpenCalendar={handlers.onOpenCalendar}
        permissions={permissions}
        canChangeSector={canChangeSector}
        remoteScriptExecutionEnabled={remoteScriptExecutionEnabled}
      />
    </>
  );
}
