// Permissoes usadas pela Central de Avisos, derivadas da funcao `can` da sessao.
export function buildAlertCenterPermissions(can, remoteScriptExecutionEnabled) {
  const canViewPreventivePlans = can("preventive_plans.view");
  const canViewPreventiveAutomation = can("preventive_automation.view");
  const canConfigureAlerts = can("alerts.configure");
  const canManageScripts = can("scripts.manage");

  return {
    remoteScriptExecutionEnabled,
    canViewAlerts: can("alerts.view"),
    canViewScripts: can("scripts.view"),
    canViewPreventivePlans,
    canViewPreventiveAutomation,
    canConfigureAlerts,
    canCommentAlerts: can("alerts.comment"),
    canManageSuggestions: can("alerts.manage_suggestions") && can("service_orders.create_from_alert"),
    canManageScripts,
    canRegisterScriptSimulation: can("scripts.register_simulation"),
    canUseScriptsFromAlerts: remoteScriptExecutionEnabled && can("scripts.use_from_alert"),
    canViewScriptLogs: can("script_logs.view"),
    canResolveScriptLogs: can("script_logs.resolve"),
    canCreatePreventivePlans: can("preventive_plans.create") && can("preventive_plans.prepare"),
    canCreatePreventiveServiceOrder: can("preventive_plans.create_service_order") && can("service_orders.create"),
    canCreatePreventiveAutomation: can("preventive_automation.create"),
    canUpdatePreventiveAutomation: can("preventive_automation.update"),
    canDisablePreventiveAutomation: can("preventive_automation.disable"),
    canDeletePreventiveAutomation: can("preventive_automation.delete"),
    canRemovePreventiveAutomationAsset: can("preventive_automation.remove_asset"),
    canManagePreventiveAutomationOverride: can("preventive_automation.manage_asset_override"),
    canUsePreventiveArea: canViewPreventivePlans || canViewPreventiveAutomation,
    canOpenSettings: canConfigureAlerts || canManageScripts
  };
}
