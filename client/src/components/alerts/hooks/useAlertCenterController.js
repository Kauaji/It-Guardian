import { useMemo } from "react";
import { useAppSession } from "../../../context/AppSessionContext.jsx";
import { useAlertCenterData } from "../../../context/AlertCenterContext.jsx";
import { remoteScriptExecutionEnabled as remoteScriptExecutionEnabledBuildFlag } from "../../../config/features.js";
import { shouldShowAutomationManagement } from "../../automation/automationUtils.js";
import { defaultAutomationManagement, defaultPrioritySettings, emptyList } from "../alertDefaults.js";
import { defaultPriorityColors } from "../alertUtils.js";
import useAlertActiveTab from "./useAlertActiveTab.js";
import useAlertCenterViewValue from "./useAlertCenterViewValue.js";
import useAlertComments from "./useAlertComments.js";
import useAlertOverview from "./useAlertOverview.js";
import useAlertSettings from "./useAlertSettings.js";
import usePreventivePlans from "./usePreventivePlans.js";
import useSuggestionsController from "./useSuggestionsController.js";

/**
 * Reúne dados, permissões e controladores da Central de Avisos (abas, ajustes,
 * comentários, sugestões e preventivas) para o componente só montar a tela.
 */
export default function useAlertCenterController({
  token,
  devices,
  segments = emptyList,
  segmentGroups = emptyList,
  inventoryTabs = emptyList,
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

  return {
    center,
    viewValue,
    inventory,
    perms,
    preventivePlans,
    preventiveAutomationPlans,
    alertCorrelations,
    canShowAutomationManagement,
    alertActiveTab,
    setAlertActiveTab,
    settings,
    commentBox,
    activeScripts,
    priorityColorById,
    dueDays,
    visibleAlerts,
    summary,
    suggestionsCtl,
    preventive
  };
}
