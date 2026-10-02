import AutomationMachineDetails from "../AutomationMachineDetails.jsx";
import AutomationPlanDetails from "../AutomationPlanDetails.jsx";

// Modais de detalhe do plano e da maquina, ligados as acoes de gravacao da tela.
export default function AutomationManagementDialogs({ selection, scripts, permissions, actions }) {
  const { selectedPlan, setSelectedPlan, selectedMachine, setSelectedMachine, openPlan, saving, run } = selection;

  return (
    <>
      <AutomationPlanDetails
        plan={selectedPlan}
        scripts={scripts}
        open={Boolean(selectedPlan)}
        canEdit={permissions.update}
        canDisable={permissions.disable}
        canDelete={permissions.delete}
        saving={saving}
        onClose={() => setSelectedPlan(null)}
        onSave={(planId, payload) => run(() => actions.onSavePlan(planId, payload))}
        onPausePlan={actions.onPausePlan ? (planId) => run(() => actions.onPausePlan(planId)) : undefined}
        onReactivatePlan={actions.onReactivatePlan ? (planId) => run(() => actions.onReactivatePlan(planId)) : undefined}
        onDelete={(plan) => run(async () => {
          await actions.onDeletePlan(plan.id);
          setSelectedPlan(null);
        })}
        onLoadHistory={actions.onFetchPlanHistory}
      />
      <AutomationMachineDetails
        machine={selectedMachine}
        open={Boolean(selectedMachine)}
        canManageOverride={permissions.manageOverride}
        canRemoveAsset={permissions.removeAsset}
        canDeletePlan={permissions.delete}
        saving={saving}
        onClose={() => setSelectedMachine(null)}
        onOpenPlan={openPlan}
        onSaveOverride={(planId, assetId, payload) => run(() => actions.onSaveOverride(planId, assetId, payload))}
        onRemoveOverride={(planId, assetId) => run(() => actions.onRemoveOverride(planId, assetId))}
        onRemoveAsset={(planId, assetId) => run(async () => {
          await actions.onRemoveAsset(planId, assetId);
          setSelectedMachine(null);
        })}
        onDeletePlan={(plan) => run(async () => {
          await actions.onDeletePlan(plan.id);
          setSelectedMachine(null);
        })}
        onLoadDetails={actions.onFetchAssetDetails}
      />
    </>
  );
}
