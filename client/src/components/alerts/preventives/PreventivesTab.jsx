import { ClipboardList } from "lucide-react";
import { useAlertCenterData } from "../../../context/AlertCenterContext.jsx";
import PreventiveAutomationPanel from "../../automation/PreventiveAutomationPanel.jsx";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";
import PreventiveCreatedSummary from "./PreventiveCreatedSummary.jsx";
import PreventiveDeviceSelector from "./PreventiveDeviceSelector.jsx";
import PreventivePlanBuilder from "./PreventivePlanBuilder.jsx";

// Aba Preventivas. `inventory` = { devices, segments, segmentGroups, inventoryTabs }.
export default function PreventivesTab({ preventive, dueDays, activeScripts, inventory, onOpenServiceOrders }) {
  const { perms } = useAlertCenterView();
  const center = useAlertCenterData();
  const hasSelection = preventive.selection.assets.size > 0;

  return (
    <section className="panel preventive-plans-panel">
      <div className="panel-heading">
        <div>
          <h2>Preventivas</h2>
        </div>
        <ClipboardList size={18} />
      </div>

      {preventive.lastCreatedPlan && (
        <PreventiveCreatedSummary
          plan={preventive.lastCreatedPlan}
          savingId={preventive.serviceOrderSavingId}
          onCreateServiceOrder={preventive.createServiceOrder}
          onOpenServiceOrder={() => onOpenServiceOrders?.()}
        />
      )}

      <div className={`preventive-workspace ${hasSelection ? "has-selection" : "single-step"}`}>
        <PreventiveDeviceSelector preventive={preventive} dueDays={dueDays} />
        {hasSelection && <PreventivePlanBuilder preventive={preventive} />}
      </div>

      {perms.canViewPreventiveAutomation && (
        <PreventiveAutomationPanel
          variant="embedded"
          plans={center.preventiveAutomationPlans}
          scripts={activeScripts}
          devices={inventory.devices}
          segments={inventory.segments}
          segmentGroups={inventory.segmentGroups}
          inventoryTabs={inventory.inventoryTabs}
          canCreate={perms.canCreatePreventiveAutomation}
          canUpdate={perms.canUpdatePreventiveAutomation}
          canDisable={perms.canDisablePreventiveAutomation}
          createRequest={preventive.automationCreateRequest}
          onSave={center.onSavePreventiveAutomationPlan}
          onDisable={center.onDisablePreventiveAutomationPlan}
          onCreateAutomatedPreventivePlan={preventive.createAutomatedPlanFromSelection}
          onCreateRequestHandled={preventive.clearAutomationCreateRequest}
        />
      )}
    </section>
  );
}
