import { useAlertFilters } from "../context/AlertFiltersContext.jsx";
import { useWorkspaceData } from "../context/workspaceContexts.js";
import { useAlertActions } from "./useAlertActions.js";
import { useMaintenanceScriptActions } from "./useMaintenanceScriptActions.js";
import { usePreventiveAutomationActions } from "./usePreventiveAutomationActions.js";
import { usePreventivePlanActions } from "./usePreventivePlanActions.js";

// Monta o valor do AlertCenterProvider (contrato de AlertCenterV2): dados,
// filtros e todas as acoes da central de Avisos.
export function useAlertCenterValue() {
  const data = useWorkspaceData();
  const filters = useAlertFilters();
  const alertActions = useAlertActions();
  const scriptActions = useMaintenanceScriptActions();
  const planActions = usePreventivePlanActions();
  const automationActions = usePreventiveAutomationActions();

  return {
    alerts: data.alerts,
    history: data.history,
    suggestions: data.serviceOrderSuggestions,
    rules: data.alertRules,
    scripts: data.maintenanceScripts,
    preventivePlans: data.preventivePlans,
    preventiveAutomationPlans: data.preventiveAutomationPlans,
    preventiveAutomationManagement: data.preventiveAutomationManagement,
    preventiveAutomationManagementError: data.preventiveAutomationManagementError,
    preventiveAutomationManagementLoading: data.loading,
    alertPriorityColors: data.alertPriorityColors,
    alertPrioritySettings: data.alertPrioritySettings,
    alertCorrelations: data.alertCorrelations,
    severityFilter: filters.severityFilter,
    setSeverityFilter: filters.setSeverityFilter,
    statusFilter: filters.statusFilter,
    setStatusFilter: filters.setStatusFilter,
    suggestionStatusFilter: filters.suggestionStatusFilter,
    setSuggestionStatusFilter: filters.setSuggestionStatusFilter,
    onEvaluateAlerts: alertActions.handleEvaluateAlerts,
    onAcceptSuggestion: alertActions.handleAcceptSuggestion,
    onRejectSuggestion: alertActions.handleRejectSuggestion,
    onCreatePreventivePlan: planActions.handleCreatePreventivePlan,
    onCreatePreventivePlanServiceOrder: planActions.handleCreatePreventivePlanServiceOrder,
    onSavePreventiveAutomationPlan: automationActions.handleSavePreventiveAutomationPlan,
    onDisablePreventiveAutomationPlan: automationActions.handleDisablePreventiveAutomationPlan,
    onReactivatePreventiveAutomationPlan: automationActions.handleReactivatePreventiveAutomationPlan,
    onDeletePreventiveAutomationPlan: automationActions.handleDeletePreventiveAutomationPlan,
    onSavePreventiveAutomationAssetOverride: automationActions.handleSavePreventiveAutomationAssetOverride,
    onRemovePreventiveAutomationAssetOverride: automationActions.handleRemovePreventiveAutomationAssetOverride,
    onRemoveAssetFromPreventiveAutomationPlan: automationActions.handleRemoveAssetFromPreventiveAutomationPlan,
    onRefreshPreventiveAutomationManagement: () => data.loadData(true),
    onFetchPreventiveAutomationAsset: automationActions.handleFetchPreventiveAutomationAsset,
    onUpdateRule: alertActions.handleUpdateAlertRule,
    onAddAlertComment: alertActions.handleAddAlertComment,
    onSaveAlertPrioritySettings: alertActions.handleSaveAlertPrioritySettings,
    onAnalyzeMaintenanceScript: scriptActions.handleAnalyzeMaintenanceScript,
    onSaveMaintenanceScript: scriptActions.handleSaveMaintenanceScript,
    onDeactivateMaintenanceScript: scriptActions.handleDeactivateMaintenanceScript,
    onRegisterMaintenanceScriptSimulation: scriptActions.handleRegisterMaintenanceScriptSimulation,
    onUseSuggestionScript: scriptActions.handleUseSuggestionScript,
    onAcknowledgeScriptLog: scriptActions.handleAcknowledgeScriptLog,
    onApplyScriptLogSuggestedSolution: scriptActions.handleApplyScriptLogSuggestedSolution,
    onCancelScriptValidation: scriptActions.handleCancelScriptValidation
  };
}
