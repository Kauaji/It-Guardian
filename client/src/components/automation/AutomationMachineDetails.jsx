import { X } from "lucide-react";
import AutomationMachineOverrideForm from "./machineDetails/AutomationMachineOverrideForm.jsx";
import AutomationMachineOverview from "./machineDetails/AutomationMachineOverview.jsx";
import AutomationMachineRemovalConfirmation from "./machineDetails/AutomationMachineRemovalConfirmation.jsx";
import useAutomationMachineDetails from "./machineDetails/useAutomationMachineDetails.js";
import { useModalLifecycle } from "../../hooks/useModalLifecycle.js";
import UnsavedChangesPrompt from "./UnsavedChangesPrompt.jsx";

function PlanSelect({ machine, selectedPlan, onChange }) {
  return (
    <label className="automation-machine-plan-select">
      Plano que deseja gerenciar
      <select value={selectedPlan.id} onChange={(event) => onChange(event.target.value)}>
        {machine.plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.planName || plan.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AutomationMachineDetails({
  machine,
  open,
  canManageOverride,
  canRemoveAsset,
  canDeletePlan,
  saving,
  onClose,
  onOpenPlan,
  onSaveOverride,
  onRemoveOverride,
  onRemoveAsset,
  onDeletePlan,
  onLoadDetails
}) {
  const state = useAutomationMachineDetails({
    machine,
    open,
    saving,
    onClose,
    onSaveOverride,
    onRemoveOverride,
    onLoadDetails
  });
  const { selectedPlan, unsavedChanges, requestClose, view, busy } = state;
  const dialogRef = useModalLifecycle(open, requestClose);

  if (!open || !machine || !selectedPlan) return null;

  function renderBody() {
    if (state.confirmingRemoval) {
      return (
        <AutomationMachineRemovalConfirmation
          machine={machine}
          plan={selectedPlan}
          isLastPlanAsset={view.isLastPlanAsset}
          canDeletePlan={canDeletePlan}
          busy={busy}
          onCancel={() => state.setConfirmingRemoval(false)}
          onDeletePlan={onDeletePlan}
          onRemoveAsset={onRemoveAsset}
        />
      );
    }
    if (state.editingOverride) {
      return (
        <AutomationMachineOverrideForm
          machine={machine}
          draft={state.overrideDraft}
          errors={state.overrideErrors}
          hasCustomOverride={view.hasCustomOverride}
          busy={busy}
          onChange={state.updateOverride}
          onSubmit={state.submitOverride}
          onUseInherited={() => unsavedChanges.requestAction(state.removeOverride)}
          onCancel={state.cancelOverrideEditing}
        />
      );
    }
    return (
      <AutomationMachineOverview
        plan={selectedPlan}
        schedule={view.displayedSchedule}
        detail={state.detail}
        effectiveOrigin={view.effectiveOrigin}
        detailLoading={state.detailLoading}
        permissions={{ canManageOverride, canRemoveAsset }}
        onOpenPlan={() => unsavedChanges.requestAction(() => onOpenPlan(selectedPlan, machine))}
        onEditOverride={state.startEditingOverride}
        onRemove={() => state.setConfirmingRemoval(true)}
        onClose={requestClose}
      />
    );
  }

  return (
    <div
      className="modal-backdrop automation-management-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        ref={dialogRef}
        className="modal-panel automation-machine-details"
        role="dialog"
        aria-modal="true"
        aria-labelledby="automation-machine-title"
      >
        <header>
          <div>
            <span>Configuração desta máquina</span>
            <h2 id="automation-machine-title">{machine.assetName}</h2>
            <p>Alterações nesta tela afetam somente esta máquina.</p>
          </div>
          <button type="button" className="icon-button" onClick={requestClose} aria-label="Fechar ações da máquina">
            <X size={18} />
          </button>
        </header>

        {machine.plans.length > 1 && <PlanSelect machine={machine} selectedPlan={selectedPlan} onChange={state.switchPlan} />}

        {state.detailLoading && <p className="automation-machine-detail-status">Carregando detalhes da agenda...</p>}
        {state.detailError && <p className="automation-machine-detail-status error">{state.detailError}</p>}

        {renderBody()}

        <UnsavedChangesPrompt
          open={unsavedChanges.confirmationOpen}
          onContinueEditing={unsavedChanges.continueEditing}
          onDiscard={unsavedChanges.discardChanges}
        />
      </section>
    </div>
  );
}
