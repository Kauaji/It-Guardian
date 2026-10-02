import { useMemo } from "react";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { useAlertCenterData } from "../../context/AlertCenterContext.jsx";
import { remoteScriptExecutionEnabled as remoteScriptExecutionEnabledBuildFlag } from "../../config/features.js";
import { shouldShowAutomationManagement } from "../automation/automationUtils.js";
import AlertCenterTabs from "./AlertCenterTabs.jsx";
import { AlertCenterViewProvider } from "./AlertCenterViewContext.jsx";
import { PreventiveSummary, SuggestionsSummary } from "./AlertSummaryCards.jsx";
import AutomationTab from "./AutomationTab.jsx";
import { defaultAutomationManagement, defaultPrioritySettings, emptyList } from "./alertDefaults.js";
import { defaultPriorityColors } from "./alertUtils.js";
import AlertDiagnosticsTab from "./diagnostics/AlertDiagnosticsTab.jsx";
import AlertHistoryTab from "./diagnostics/AlertHistoryTab.jsx";
import useAlertActiveTab from "./hooks/useAlertActiveTab.js";
import useAlertCenterViewValue from "./hooks/useAlertCenterViewValue.js";
import useAlertComments from "./hooks/useAlertComments.js";
import useAlertOverview from "./hooks/useAlertOverview.js";
import useAlertSettings from "./hooks/useAlertSettings.js";
import usePreventivePlans from "./hooks/usePreventivePlans.js";
import useSuggestionsController from "./hooks/useSuggestionsController.js";
import PreventiveReviewModal from "./preventives/PreventiveReviewModal.jsx";
import PreventivesTab from "./preventives/PreventivesTab.jsx";
import AlertSettingsModal from "./settings/AlertSettingsModal.jsx";
import ScriptLogModal from "./suggestions/ScriptLogModal.jsx";
import SuggestionInfoModal from "./suggestions/SuggestionInfoModal.jsx";
import SuggestionsTab from "./suggestions/SuggestionsTab.jsx";

export default function AlertCenterV2({
  token,
  devices,
  segments = emptyList,
  segmentGroups = emptyList,
  inventoryTabs = emptyList,
  serviceOrders,
  onOpenServiceOrders,
  remoteScriptExecutionEnabled: remoteScriptExecutionEnabledProp
}) {
  const { can } = useAppSession();
  const center = useAlertCenterData();
  const {
    scripts,
    preventivePlans = emptyList,
    preventiveAutomationPlans = emptyList,
    preventiveAutomationManagement = defaultAutomationManagement,
    alertPriorityColors = defaultPriorityColors,
    alertPrioritySettings = defaultPrioritySettings,
    alertCorrelations = emptyList
  } = center;
  const inventory = useMemo(
    () => ({ devices, segments, segmentGroups, inventoryTabs }),
    [devices, segments, segmentGroups, inventoryTabs]
  );
  // Prefere o valor real do servidor (buscado no carregamento inicial,
  // sem exigir rebuild) sobre o flag de build-time - so cai no flag de
  // build antes do primeiro carregamento ou se a prop nao for passada.
  const viewValue = useAlertCenterViewValue({
    can,
    remoteScriptExecutionEnabled: remoteScriptExecutionEnabledProp ?? remoteScriptExecutionEnabledBuildFlag,
    inventory
  });
  const { perms, lookups } = viewValue;

  const automationManagementPlanCount = Math.max(
    Number(preventiveAutomationManagement?.metadata?.planCount || 0),
    Array.isArray(preventiveAutomationPlans) ? preventiveAutomationPlans.length : 0
  );
  const canShowAutomationManagement = shouldShowAutomationManagement(
    perms.canViewPreventiveAutomation,
    automationManagementPlanCount
  );
  const [alertActiveTab, setAlertActiveTab] = useAlertActiveTab({
    canShowAutomationManagement,
    canUsePreventiveArea: perms.canUsePreventiveArea,
    canViewAlerts: perms.canViewAlerts
  });

  const settings = useAlertSettings({
    alertPrioritySettings,
    onSaveAlertPrioritySettings: center.onSaveAlertPrioritySettings
  });
  const commentBox = useAlertComments({
    canComment: perms.canCommentAlerts,
    onAddAlertComment: center.onAddAlertComment
  });
  const activeScripts = useMemo(() => scripts.filter((script) => script.active !== false), [scripts]);
  const priorityColorById = useMemo(
    () => ({ ...defaultPriorityColors, ...(alertPriorityColors || {}) }),
    [alertPriorityColors]
  );
  const dueDays = Number(settings.priorityDraft.preventiveDueDays || alertPrioritySettings.preventiveDueDays || 180);
  const { visibleAlerts, summary } = useAlertOverview({ center, devices, lookups });
  const suggestionsCtl = useSuggestionsController({
    center,
    token,
    devices,
    lookups,
    alertCorrelations,
    activeScripts,
    validationWindowMinutes: settings.priorityDraft.scriptValidationWindowMinutes
  });
  const preventive = usePreventivePlans({
    data: {
      token,
      devices,
      alerts: center.alerts,
      lookups,
      preventivePlans,
      automationMachines: preventiveAutomationManagement?.machines,
      activeScripts,
      dueDays
    },
    activeTab: alertActiveTab,
    canCreatePlans: perms.canCreatePreventivePlans,
    handlers: {
      onCreatePreventivePlan: center.onCreatePreventivePlan,
      onCreatePreventivePlanServiceOrder: center.onCreatePreventivePlanServiceOrder
    }
  });

  return (
    <AlertCenterViewProvider value={viewValue}>
      <section className="view-stack alerts-view-v2">
        {(perms.canViewAlerts || perms.canViewPreventivePlans || perms.canViewPreventiveAutomation) && (
          <>
            {perms.canViewAlerts && alertActiveTab === "suggestions" && <SuggestionsSummary summary={summary} />}

            {perms.canUsePreventiveArea && alertActiveTab === "preventives" && (
              <PreventiveSummary
                summary={preventive.summary}
                plans={preventivePlans}
                automationPlans={preventiveAutomationPlans}
              />
            )}

            <AlertCenterTabs
              activeTab={alertActiveTab}
              canShowAutomationManagement={canShowAutomationManagement}
              onChange={setAlertActiveTab}
              onOpenLog={suggestionsCtl.scriptLog.openLatestLog}
              onOpenSettings={settings.openSettings}
            />

            {alertActiveTab === "active" && (
              <AlertDiagnosticsTab
                visibleAlerts={visibleAlerts}
                alertCorrelations={alertCorrelations}
                commentBox={commentBox}
              />
            )}

            {alertActiveTab === "suggestions" && (
              <SuggestionsTab
                visibleSuggestions={suggestionsCtl.visibleSuggestions}
                visibleAlerts={visibleAlerts}
                priorityColorById={priorityColorById}
                scriptMenu={suggestionsCtl.scriptMenu}
                actions={suggestionsCtl.actions}
              />
            )}

            {alertActiveTab === "preventives" && perms.canUsePreventiveArea && (
              <PreventivesTab
                preventive={preventive}
                dueDays={dueDays}
                activeScripts={activeScripts}
                inventory={inventory}
                onOpenServiceOrders={onOpenServiceOrders}
              />
            )}

            {alertActiveTab === "automation" && canShowAutomationManagement && (
              <AutomationTab token={token} inventory={inventory} />
            )}

            {preventive.reviewOpen && <PreventiveReviewModal preventive={preventive} />}

            {alertActiveTab === "history" && (
              <AlertHistoryTab
                resolvedAlerts={summary.resolvedAlerts}
                handledSuggestions={summary.handledSuggestions}
              />
            )}
          </>
        )}

        {suggestionsCtl.selectedSuggestion && suggestionsCtl.selectedModel && (
          <SuggestionInfoModal
            suggestion={suggestionsCtl.selectedSuggestion}
            model={suggestionsCtl.selectedModel}
            index={suggestionsCtl.selectedIndex}
            commentBox={commentBox}
            onAccept={center.onAcceptSuggestion}
            onReject={center.onRejectSuggestion}
            onClose={suggestionsCtl.closeInfo}
          />
        )}

        {suggestionsCtl.scriptLog.selectedScriptLog && <ScriptLogModal scriptLog={suggestionsCtl.scriptLog} />}

        {settings.settingsOpen && (
          <AlertSettingsModal settings={settings} devices={devices} serviceOrders={serviceOrders} />
        )}
      </section>
    </AlertCenterViewProvider>
  );
}
