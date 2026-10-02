import { lazy, Suspense } from "react";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import ViewErrorBoundary from "../../components/ui/ViewErrorBoundary.jsx";
import ViewLoadingState from "../../components/ui/ViewLoadingState.jsx";
import { useInventory, useNavigation, useWorkspaceData } from "../context/workspaceContexts.js";
import { partsInventoryPermissions } from "../viewAccess.js";

const PartsInventoryPage = lazy(() => import("../../components/partsInventory/PartsInventoryPage.jsx"));

export default function PartsInventoryView() {
  const { token, user, notify } = useAppSession();
  const { serviceOrders } = useWorkspaceData();
  const { model } = useInventory();
  const { openInventoryAsset } = useNavigation();

  return (
    <ViewErrorBoundary label="o Inventário de Peças" resetKey="parts-inventory">
      <Suspense fallback={<ViewLoadingState />}>
        <PartsInventoryPage
          token={token}
          notify={notify}
          devices={model.decoratedAllDevices}
          tabs={model.inventoryTabs}
          groups={model.decoratedSegmentGroups}
          segments={model.decoratedSegments}
          serviceOrders={serviceOrders}
          onOpenAsset={openInventoryAsset}
          permissions={partsInventoryPermissions(user)}
        />
      </Suspense>
    </ViewErrorBoundary>
  );
}
