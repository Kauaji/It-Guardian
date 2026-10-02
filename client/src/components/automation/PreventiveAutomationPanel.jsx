import PreventiveAutomationModal from "./preventivePanel/PreventiveAutomationModal.jsx";
import PreventiveAutomationPlanList from "./preventivePanel/PreventiveAutomationPlanList.jsx";
import usePreventiveAutomationForm from "./preventivePanel/usePreventiveAutomationForm.js";
import usePreventiveAutomationToggle from "./preventivePanel/usePreventiveAutomationToggle.js";

export default function PreventiveAutomationPanel({
  variant = "standalone",
  plans = [],
  scripts = [],
  devices = [],
  segments = [],
  segmentGroups = [],
  inventoryTabs = [],
  canCreate,
  canUpdate,
  canDisable,
  createRequest = null,
  onSave,
  onDisable,
  onCreateAutomatedPreventivePlan,
  onCreateRequestHandled
}) {
  const formState = usePreventiveAutomationForm({
    plans,
    onSave,
    onCreateAutomatedPreventivePlan,
    createRequest,
    onCreateRequestHandled
  });
  const { togglingId, toggleAutomationPlan } = usePreventiveAutomationToggle({ onSave, onDisable });
  const activeScripts = scripts.filter((script) => script.active !== false);
  const scopeSources = { devices, segments, segmentGroups, inventoryTabs };

  return (
    <section className={`panel preventive-automation-panel ${variant === "embedded" ? "embedded" : ""}`}>
      {variant !== "embedded" && (
        <PreventiveAutomationPlanList
          plans={plans}
          scopeSources={scopeSources}
          permissions={{ canCreate, canUpdate, canDisable }}
          togglingId={togglingId}
          onCreate={formState.openCreateModal}
          onEdit={formState.openEditModal}
          onToggle={toggleAutomationPlan}
        />
      )}

      {formState.modalOpen && (
        <PreventiveAutomationModal
          formState={formState}
          plans={plans}
          activeScripts={activeScripts}
          scopeSources={scopeSources}
        />
      )}
    </section>
  );
}
