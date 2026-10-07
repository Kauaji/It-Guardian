import { lazy, Suspense } from "react";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import ViewErrorBoundary from "../../components/ui/ViewErrorBoundary.jsx";
import ViewLoadingState from "../../components/ui/ViewLoadingState.jsx";
import { useInventory, useNavigation, useServiceOrderActions, useWorkspaceData } from "../context/workspaceContexts.js";
import { serviceOrderPermissions } from "../viewAccess.js";

const ServiceOrdersBoard = lazy(() => import("../../components/serviceOrders/ServiceOrdersBoard.jsx"));

export default function ServiceOrdersView() {
  const { token, user, notify } = useAppSession();
  const { remoteScriptExecutionEnabled, serviceOrders, systemMode } = useWorkspaceData();
  const { model } = useInventory();
  const { openCalendar } = useNavigation();
  const actions = useServiceOrderActions();

  return (
    <ViewErrorBoundary label="Ordens de Serviço" resetKey="service-orders">
      <Suspense fallback={<ViewLoadingState />}>
        <ServiceOrdersBoard
          serviceOrders={serviceOrders}
          devices={model.decoratedAllDevices}
          segments={model.decoratedSegments}
          groups={model.decoratedSegmentGroups}
          tabs={model.inventoryTabs}
          activeTab={model.activeInventoryTab}
          token={token}
          notify={notify}
          systemMode={systemMode}
          saving={actions.serviceOrderSaving}
          onCreate={actions.handleCreateServiceOrder}
          onUpdate={actions.handleUpdateServiceOrder}
          onAddHistory={actions.handleAddServiceOrderHistory}
          onStatusChange={actions.handleChangeServiceOrderStatus}
          onDelete={actions.handleDeleteServiceOrder}
          onSelectBackup={actions.handleSelectBackupForServiceOrder}
          onReleaseBackup={actions.releaseBackupForServiceOrder}
          onReopen={actions.handleReopenServiceOrder}
          onOpenCalendar={openCalendar}
          user={user}
          remoteScriptExecutionEnabled={remoteScriptExecutionEnabled}
          permissions={serviceOrderPermissions(user)}
        />
      </Suspense>
    </ViewErrorBoundary>
  );
}
