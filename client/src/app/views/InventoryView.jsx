import { lazy, Suspense } from "react";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import ViewErrorBoundary from "../../components/ui/ViewErrorBoundary.jsx";
import ViewLoadingState from "../../components/ui/ViewLoadingState.jsx";
import { useInventory, useInventoryActions, useLayout } from "../context/workspaceContexts.js";
import { useViewAccess } from "../hooks/useViewAccess.js";
import { floorPlanPermissions } from "../viewAccess.js";
import { buildAssetProps, buildBoardDataProps, buildSelectionProps, buildStructureProps } from "./inventoryBoardProps.js";

const InventoryBoard = lazy(() => import("../../components/inventory/InventoryBoard.jsx"));
const FloorPlansModule = lazy(() => import("../../components/floorPlans/FloorPlansModule.jsx"));
const InventoryNetworkTopologyView = lazy(() => import("../../components/inventory/topology/InventoryNetworkTopologyView.jsx"));

// Inventario de Ativos: o quadro de segmentos, a aba de plantas (/plantas/*)
// e o mapa de rede. As sub-abas continuam sendo estado interno do
// InventoryBoard; so as plantas tem URL propria.
export default function InventoryView() {
  const session = useAppSession();
  const { token, user, notify } = session;
  const access = useViewAccess();
  const inventory = useInventory();
  const actions = useInventoryActions();
  const { bulkPrint, drag, sidebar } = useLayout();
  const { model } = inventory;

  const boardProps = {
    ...buildBoardDataProps({ access, drag, sidebar, session, ...inventory }),
    ...buildSelectionProps({ bulkPrint, ...inventory, ...actions }),
    ...buildStructureProps({ model, ...actions }),
    ...buildAssetProps(actions)
  };

  const floorPlansView = access.canViewFloorPlans ? (
    <FloorPlansModule
      token={token}
      notify={notify}
      devices={model.decoratedAllDevices}
      segments={model.decoratedSegments}
      groups={model.decoratedSegmentGroups}
      activeTab={model.activeInventoryTab}
      permissions={floorPlanPermissions(user)}
    />
  ) : null;

  const topologyView = access.canViewTopology ? (
    <InventoryNetworkTopologyView
      token={token}
      notify={notify}
      devices={model.decoratedAllDevices}
      segments={model.decoratedSegments}
      groups={model.decoratedSegmentGroups}
      tabs={model.inventoryTabs}
      activeTab={model.activeInventoryTab}
      onSelectTab={actions.tabs.selectInventoryTab}
    />
  ) : null;

  return (
    <ViewErrorBoundary label="o Inventário" resetKey="inventory">
      <Suspense fallback={<ViewLoadingState />}>
        <InventoryBoard {...boardProps} floorPlansView={floorPlansView} topologyView={topologyView} />
      </Suspense>
    </ViewErrorBoundary>
  );
}
