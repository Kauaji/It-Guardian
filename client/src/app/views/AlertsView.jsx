import { useAppSession } from "../../context/AppSessionContext.jsx";
import { AlertCenterProvider } from "../../context/AlertCenterContext.jsx";
import AlertCenterV2 from "../../components/alerts/AlertCenterV2.jsx";
import ViewErrorBoundary from "../../components/ui/ViewErrorBoundary.jsx";
import { useInventory, useNavigation, useWorkspaceData } from "../context/workspaceContexts.js";
import { useAlertCenterValue } from "../hooks/useAlertCenterValue.js";

export default function AlertsView() {
  const { token } = useAppSession();
  const { remoteScriptExecutionEnabled, serviceOrders } = useWorkspaceData();
  const { model } = useInventory();
  const { goToView } = useNavigation();
  const alertCenterValue = useAlertCenterValue();

  return (
    <ViewErrorBoundary label="Avisos" resetKey="alerts">
      <AlertCenterProvider value={alertCenterValue}>
        <AlertCenterV2
          token={token}
          devices={model.decoratedAllDevices}
          segments={model.decoratedSegments}
          segmentGroups={model.decoratedSegmentGroups}
          inventoryTabs={model.inventoryTabs}
          serviceOrders={serviceOrders}
          onOpenServiceOrders={() => goToView("service-orders")}
          remoteScriptExecutionEnabled={remoteScriptExecutionEnabled}
        />
      </AlertCenterProvider>
    </ViewErrorBoundary>
  );
}
