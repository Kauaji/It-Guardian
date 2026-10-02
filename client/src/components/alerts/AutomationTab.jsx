import { lazy, Suspense, useCallback } from "react";
import { fetchPreventiveAutomationAgenda, fetchPreventiveAutomationPlanHistory } from "../../api.js";
import { useAlertCenterData } from "../../context/AlertCenterContext.jsx";
import ViewLoadingState from "../ui/ViewLoadingState.jsx";
import { defaultAutomationManagement } from "./alertDefaults.js";
import { useAlertCenterView } from "./AlertCenterViewContext.jsx";

const AutomationManagementView = lazy(() => import("../automation/AutomationManagementView.jsx"));

// Aba "Automatizacoes": carrega a tela de gerenciamento sob demanda e a liga
// as permissoes e acoes do contexto. `inventory` = { devices, segments, segmentGroups, inventoryTabs }.
export default function AutomationTab({ token, inventory }) {
  const { perms } = useAlertCenterView();
  const center = useAlertCenterData();
  const loadAgenda = useCallback((filters) => fetchPreventiveAutomationAgenda(token, filters), [token]);
  const loadPlanHistory = useCallback((planId) => fetchPreventiveAutomationPlanHistory(token, planId), [token]);

  return (
    <Suspense fallback={<ViewLoadingState />}>
      <AutomationManagementView
        management={center.preventiveAutomationManagement ?? defaultAutomationManagement}
        devices={inventory.devices}
        segments={inventory.segments}
        segmentGroups={inventory.segmentGroups}
        inventoryTabs={inventory.inventoryTabs}
        scripts={center.scripts}
        loading={center.preventiveAutomationManagementLoading ?? false}
        error={center.preventiveAutomationManagementError ?? ""}
        permissions={{
          update: perms.canUpdatePreventiveAutomation,
          disable: perms.canDisablePreventiveAutomation,
          delete: perms.canDeletePreventiveAutomation,
          removeAsset: perms.canRemovePreventiveAutomationAsset,
          manageOverride: perms.canManagePreventiveAutomationOverride
        }}
        onRetry={center.onRefreshPreventiveAutomationManagement}
        onSavePlan={center.onSavePreventiveAutomationPlan}
        onPausePlan={center.onDisablePreventiveAutomationPlan}
        onReactivatePlan={center.onReactivatePreventiveAutomationPlan}
        onDeletePlan={center.onDeletePreventiveAutomationPlan}
        onSaveOverride={center.onSavePreventiveAutomationAssetOverride}
        onRemoveOverride={center.onRemovePreventiveAutomationAssetOverride}
        onRemoveAsset={center.onRemoveAssetFromPreventiveAutomationPlan}
        onFetchAssetDetails={center.onFetchPreventiveAutomationAsset}
        onFetchAgenda={loadAgenda}
        onFetchPlanHistory={loadPlanHistory}
      />
    </Suspense>
  );
}
