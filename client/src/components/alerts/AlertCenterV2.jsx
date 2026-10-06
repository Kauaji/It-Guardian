import AlertCenterTabs from "./AlertCenterTabs.jsx";
import { AlertCenterViewProvider } from "./AlertCenterViewContext.jsx";
import { PreventiveSummary, SuggestionsSummary } from "./AlertSummaryCards.jsx";
import AutomationTab from "./AutomationTab.jsx";
import { emptyList } from "./alertDefaults.js";
import AlertDiagnosticsTab from "./diagnostics/AlertDiagnosticsTab.jsx";
import AlertHistoryTab from "./diagnostics/AlertHistoryTab.jsx";
import useAlertCenterController from "./hooks/useAlertCenterController.js";
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
  remoteScriptExecutionEnabled
}) {
  const ctl = useAlertCenterController({
    token,
    devices,
    segments,
    segmentGroups,
    inventoryTabs,
    remoteScriptExecutionEnabled
  });
  const { center, perms, suggestionsCtl, settings, preventive, alertActiveTab, commentBox } = ctl;

  return (
    <AlertCenterViewProvider value={ctl.viewValue}>
      <section className="view-stack alerts-view-v2">
        {(perms.canViewAlerts || perms.canViewPreventivePlans || perms.canViewPreventiveAutomation) && (
          <>
            {perms.canViewAlerts && alertActiveTab === "suggestions" && <SuggestionsSummary summary={ctl.summary} />}

            {perms.canUsePreventiveArea && alertActiveTab === "preventives" && (
              <PreventiveSummary summary={preventive.summary} plans={ctl.preventivePlans} automationPlans={ctl.preventiveAutomationPlans} />
            )}

            <AlertCenterTabs
              activeTab={alertActiveTab}
              canShowAutomationManagement={ctl.canShowAutomationManagement}
              onChange={ctl.setAlertActiveTab}
              onOpenLog={suggestionsCtl.scriptLog.openLatestLog}
              onOpenSettings={settings.openSettings}
            />

            {alertActiveTab === "active" && (
              <AlertDiagnosticsTab visibleAlerts={ctl.visibleAlerts} alertCorrelations={ctl.alertCorrelations} commentBox={commentBox} />
            )}

            {alertActiveTab === "suggestions" && (
              <SuggestionsTab
                visibleSuggestions={suggestionsCtl.visibleSuggestions}
                visibleAlerts={ctl.visibleAlerts}
                priorityColorById={ctl.priorityColorById}
                scriptMenu={suggestionsCtl.scriptMenu}
                actions={suggestionsCtl.actions}
              />
            )}

            {alertActiveTab === "preventives" && perms.canUsePreventiveArea && (
              <PreventivesTab
                preventive={preventive}
                dueDays={ctl.dueDays}
                activeScripts={ctl.activeScripts}
                inventory={ctl.inventory}
                onOpenServiceOrders={onOpenServiceOrders}
              />
            )}

            {alertActiveTab === "automation" && ctl.canShowAutomationManagement && (
              <AutomationTab token={token} inventory={ctl.inventory} />
            )}

            {preventive.reviewOpen && <PreventiveReviewModal preventive={preventive} />}

            {alertActiveTab === "history" && (
              <AlertHistoryTab resolvedAlerts={ctl.summary.resolvedAlerts} handledSuggestions={ctl.summary.handledSuggestions} />
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

        {settings.settingsOpen && <AlertSettingsModal settings={settings} devices={devices} serviceOrders={serviceOrders} />}
      </section>
    </AlertCenterViewProvider>
  );
}
