import { X } from "lucide-react";
import { AutomationPlanDeleteConfirmation, AutomationPlanStatusConfirmation } from "./planDetails/AutomationPlanConfirmations.jsx";
import AutomationPlanEditForm from "./planDetails/AutomationPlanEditForm.jsx";
import AutomationPlanOverview from "./planDetails/AutomationPlanOverview.jsx";
import AutomationPlanTabPanel, { AutomationPlanTabNav } from "./planDetails/AutomationPlanTabPanel.jsx";
import useAutomationPlanDetails from "./planDetails/useAutomationPlanDetails.js";
import { useModalLifecycle } from "../../hooks/useModalLifecycle.js";
import UnsavedChangesPrompt from "./UnsavedChangesPrompt.jsx";

function PlanDetailsBody({ plan, state, permissions, scripts, onDelete }) {
  const { activeTab } = state;

  if (state.confirmingDelete) {
    return (
      <AutomationPlanDeleteConfirmation
        plan={plan}
        deleteConfirmation={state.deleteConfirmation}
        busy={state.busy}
        onChange={state.setDeleteConfirmation}
        onCancel={() => state.setConfirmingDelete(false)}
        onConfirm={onDelete}
      />
    );
  }
  if (state.confirmingStatus) {
    return (
      <AutomationPlanStatusConfirmation
        plan={plan}
        busy={state.busy}
        onCancel={() => state.setConfirmingStatus(false)}
        onConfirm={state.changeStatus}
      />
    );
  }
  if (state.editing) {
    return (
      <AutomationPlanEditForm
        draft={state.draft}
        errors={state.errors}
        scripts={scripts}
        busy={state.busy}
        onChange={state.updateDraft}
        onToggleScript={state.toggleScript}
        onSubmit={state.submit}
        onCancel={state.cancelEditing}
      />
    );
  }
  if (activeTab !== "summary") {
    return (
      <AutomationPlanTabPanel
        tab={activeTab}
        plan={plan}
        linkedScripts={state.linkedScripts}
        history={state.history}
        historyLoading={state.historyLoading}
      />
    );
  }
  return (
    <AutomationPlanOverview
      plan={plan}
      linkedScripts={state.linkedScripts}
      permissions={permissions}
      onEdit={state.startEditing}
      onStatus={() => state.setConfirmingStatus(true)}
      onDelete={() => state.setConfirmingDelete(true)}
      onClose={state.requestClose}
    />
  );
}

export default function AutomationPlanDetails({
  plan,
  scripts = [],
  open,
  canEdit,
  canDisable,
  canDelete,
  saving,
  onClose,
  onSave,
  onPausePlan,
  onReactivatePlan,
  onDelete,
  onLoadHistory
}) {
  const state = useAutomationPlanDetails({
    plan,
    scripts,
    open,
    saving,
    onClose,
    onSave,
    onPausePlan,
    onReactivatePlan,
    onLoadHistory
  });
  const { unsavedChanges, requestClose } = state;
  const dialogRef = useModalLifecycle(open, requestClose);

  if (!open || !plan) return null;
  const permissions = {
    canEdit,
    canStatus: canDisable && (onPausePlan || onReactivatePlan),
    canDelete
  };
  const showTabs = !state.editing && !state.confirmingDelete && !state.confirmingStatus;

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
        className="modal-panel automation-plan-details"
        role="dialog"
        aria-modal="true"
        aria-labelledby="automation-plan-title"
      >
        <header>
          <div>
            <span>Configuração geral do plano</span>
            <h2 id="automation-plan-title">{plan.name}</h2>
            <p>Estas configurações afetam todas as máquinas, exceto aquelas que possuem recorrência personalizada.</p>
          </div>
          <button type="button" className="icon-button" onClick={requestClose} aria-label="Fechar detalhes do plano">
            <X size={18} />
          </button>
        </header>
        {showTabs && <AutomationPlanTabNav activeTab={state.activeTab} onChange={state.setActiveTab} />}

        <PlanDetailsBody plan={plan} state={state} permissions={permissions} scripts={scripts} onDelete={onDelete} />

        <UnsavedChangesPrompt
          open={unsavedChanges.confirmationOpen}
          onContinueEditing={unsavedChanges.continueEditing}
          onDiscard={unsavedChanges.discardChanges}
        />
      </section>
    </div>
  );
}
