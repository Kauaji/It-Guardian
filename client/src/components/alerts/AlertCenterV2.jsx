import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Info,
  KeyRound,
  Monitor,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  XCircle
} from "lucide-react";
import {
  fetchMaintenanceScriptRecommendations,
  fetchPreventiveAutomationAgenda,
  fetchPreventiveAutomationPlanHistory,
  fetchSuggestionRecommendedScripts
} from "../../api.js";
import AutomationIndicatorDots from "../AutomationIndicatorDots.jsx";
import PreventiveAutomationPanel from "../automation/PreventiveAutomationPanel.jsx";
import { shouldShowAutomationManagement } from "../automation/automationUtils.js";
import MaintenanceScriptsPanel from "../maintenance/MaintenanceScriptsPanel.jsx";
import SummaryCard from "../ui/SummaryCard.jsx";
import ViewLoadingState from "../ui/ViewLoadingState.jsx";
import { formatDate, isMaintenanceSegmentName } from "../../utils/display.js";
import {
  alertTypeLabels,
  canCreateServiceOrderFromSuggestion,
  canRejectSuggestion,
  canUseScriptOnSuggestion,
  defaultPriorityColors,
  formatAlertThreshold,
  formatAlertValue,
  formatSuggestionCode,
  getAlertCategory,
  getAlertConfidence,
  getAlertImpact,
  getAlertProbableCause,
  getAlertRecommendedAction,
  getAlertTrend,
  getScriptValidationTooltip,
  getSuggestionMachineLabel,
  isDurationDisabled,
  isPercentThresholdRule,
  isThresholdDisabled,
  normalizePrioritySettings,
  normalizeText,
  priorityLabels,
  scriptValidationLabels,
  suggestionStatusLabels
} from "./alertUtils.js";

const AutomationManagementView = lazy(() => import("../automation/AutomationManagementView.jsx"));

export default function AlertCenterV2({
  token,
  alerts,
  history,
  suggestions,
  rules,
  scripts,
  preventivePlans = [],
  preventiveAutomationPlans = [],
  preventiveAutomationManagement = { plans: [], machines: [], metadata: { planCount: 0, machineCount: 0 } },
  preventiveAutomationManagementError = "",
  preventiveAutomationManagementLoading = false,
  devices,
  segments = [],
  segmentGroups = [],
  inventoryTabs = [],
  alertPriorityColors = defaultPriorityColors,
  alertPrioritySettings = normalizePrioritySettings(),
  alertCorrelations = [],
  serviceOrders,
  severityFilter,
  setSeverityFilter,
  statusFilter,
  setStatusFilter,
  suggestionStatusFilter,
  setSuggestionStatusFilter,
  canViewAlerts,
  canManageSuggestions,
  canConfigureAlerts,
  canConfigureAlertPrioritySettings,
  canCommentAlerts,
  canViewScripts,
  canManageScripts,
  canRegisterScriptSimulation,
  canUseScriptsFromAlerts,
  canViewScriptLogs,
  canResolveScriptLogs,
  canViewPreventivePlans,
  canCreatePreventivePlans,
  canCreatePreventiveServiceOrder,
  canViewPreventiveAutomation,
  canCreatePreventiveAutomation,
  canUpdatePreventiveAutomation,
  canDisablePreventiveAutomation,
  canDeletePreventiveAutomation,
  canRemovePreventiveAutomationAsset,
  canManagePreventiveAutomationOverride,
  onEvaluateAlerts,
  onAcceptSuggestion,
  onRejectSuggestion,
  onCreatePreventivePlan,
  onCreatePreventivePlanServiceOrder,
  onSavePreventiveAutomationPlan,
  onDisablePreventiveAutomationPlan,
  onReactivatePreventiveAutomationPlan,
  onDeletePreventiveAutomationPlan,
  onSavePreventiveAutomationAssetOverride,
  onRemovePreventiveAutomationAssetOverride,
  onRemoveAssetFromPreventiveAutomationPlan,
  onRefreshPreventiveAutomationManagement,
  onFetchPreventiveAutomationAsset,
  onOpenServiceOrders,
  onUpdateRule,
  onAddAlertComment,
  onSaveAlertPrioritySettings,
  onAnalyzeMaintenanceScript,
  onSaveMaintenanceScript,
  onDeactivateMaintenanceScript,
  onRegisterMaintenanceScriptSimulation,
  onUseSuggestionScript,
  onAcknowledgeScriptLog,
  onApplyScriptLogSuggestedSolution,
  onCancelScriptValidation
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertActiveTab, setAlertActiveTab] = useState("suggestions");
  const [settingsSectionsOpen, setSettingsSectionsOpen] = useState({
    rules: false,
    priority: false,
    scripts: false
  });
  const [openScriptMenuSuggestionId, setOpenScriptMenuSuggestionId] = useState(null);
  const [scriptRecommendationsBySuggestion, setScriptRecommendationsBySuggestion] = useState({});
  const [loadingScriptRecommendationId, setLoadingScriptRecommendationId] = useState(null);
  const [usingSuggestionScriptKey, setUsingSuggestionScriptKey] = useState("");
  const [priorityDraft, setPriorityDraft] = useState(() => normalizePrioritySettings(alertPrioritySettings));
  const [prioritySaving, setPrioritySaving] = useState(false);
  const [priorityColorsOpen, setPriorityColorsOpen] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [selectedSuggestionInfoId, setSelectedSuggestionInfoId] = useState(null);
  const [selectedScriptLog, setSelectedScriptLog] = useState(null);
  const [scriptLogCustomNotes, setScriptLogCustomNotes] = useState("");
  const [preventiveSearch, setPreventiveSearch] = useState("");
  const [preventiveFilter, setPreventiveFilter] = useState("all");
  const [selectedPreventiveAssets, setSelectedPreventiveAssets] = useState(() => new Set());
  const [selectedPreventiveScripts, setSelectedPreventiveScripts] = useState(() => new Set());
  const [expandedPreventiveScripts, setExpandedPreventiveScripts] = useState(() => new Set());
  const [preventiveScriptRecommendations, setPreventiveScriptRecommendations] = useState({
    recommended: [],
    others: [],
    loading: false,
    error: ""
  });
  const [preventivePlanName, setPreventivePlanName] = useState("Plano preventivo");
  const [preventiveSaving, setPreventiveSaving] = useState(false);
  const [preventiveServiceOrderSavingId, setPreventiveServiceOrderSavingId] = useState(null);
  const [preventiveAutomationCreateRequest, setPreventiveAutomationCreateRequest] = useState(null);
  const [lastCreatedPreventivePlan, setLastCreatedPreventivePlan] = useState(null);
  const [preventiveReviewOpen, setPreventiveReviewOpen] = useState(false);
  const canUsePreventiveArea = canViewPreventivePlans || canViewPreventiveAutomation;
  const automationManagementPlanCount = Math.max(
    Number(preventiveAutomationManagement?.metadata?.planCount || 0),
    Array.isArray(preventiveAutomationPlans) ? preventiveAutomationPlans.length : 0
  );
  const canShowAutomationManagement = shouldShowAutomationManagement(
    canViewPreventiveAutomation,
    automationManagementPlanCount
  );
  const handlePreventiveAutomationCreateRequestHandled = useCallback(() => {
    setPreventiveAutomationCreateRequest(null);
  }, []);
  const loadPreventiveAutomationAgenda = useCallback(
    (filters) => fetchPreventiveAutomationAgenda(token, filters),
    [token]
  );
  const loadPreventiveAutomationPlanHistory = useCallback(
    (planId) => fetchPreventiveAutomationPlanHistory(token, planId),
    [token]
  );

  useEffect(() => {
    if (alertActiveTab === "automation") {
      if (canShowAutomationManagement) return;
      if (canUsePreventiveArea) setAlertActiveTab("preventives");
      else if (canViewAlerts) setAlertActiveTab("suggestions");
      return;
    }
    if (alertActiveTab === "suggestions" && !canViewAlerts) {
      if (canUsePreventiveArea) {
        setAlertActiveTab("preventives");
      }
    }
    if (alertActiveTab === "preventives" && !canUsePreventiveArea && canViewAlerts) {
      setAlertActiveTab("suggestions");
    }
  }, [alertActiveTab, canShowAutomationManagement, canUsePreventiveArea, canViewAlerts]);

  useEffect(() => {
    if (alertActiveTab !== "preventives" && preventiveAutomationCreateRequest) {
      setPreventiveAutomationCreateRequest(null);
    }
  }, [alertActiveTab, preventiveAutomationCreateRequest]);

  useEffect(() => {
    setPriorityDraft(normalizePrioritySettings(alertPrioritySettings));
  }, [alertPrioritySettings]);

  useEffect(() => {
    if (!settingsOpen) return;
    setSettingsSectionsOpen({
      rules: false,
      priority: false,
      scripts: false
    });
    setPriorityColorsOpen(false);
  }, [settingsOpen]);

  useEffect(() => {
    const dialogOpen = settingsOpen || preventiveReviewOpen || Boolean(selectedSuggestionInfoId) || Boolean(selectedScriptLog);
    if (!dialogOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [settingsOpen, preventiveReviewOpen, selectedSuggestionInfoId, selectedScriptLog]);

  useEffect(() => {
    const dialogOpen = settingsOpen || preventiveReviewOpen || Boolean(selectedSuggestionInfoId) || Boolean(selectedScriptLog);
    if (!dialogOpen) return undefined;

    function handleAlertDialogKeydown(event) {
      if (event.key !== "Escape") return;

      if (selectedScriptLog) {
        setSelectedScriptLog(null);
      } else if (selectedSuggestionInfoId) {
        setSelectedSuggestionInfoId(null);
      } else if (preventiveReviewOpen) {
        setPreventiveReviewOpen(false);
      } else if (settingsOpen) {
        setSettingsOpen(false);
      }
    }

    window.addEventListener("keydown", handleAlertDialogKeydown);
    return () => window.removeEventListener("keydown", handleAlertDialogKeydown);
  }, [settingsOpen, preventiveReviewOpen, selectedSuggestionInfoId, selectedScriptLog]);

  const visibleAlerts = history.filter((alert) => {
    const severityMatches = severityFilter === "all" || alert.severity === severityFilter;
    const statusMatches =
      statusFilter === "all" ||
      (statusFilter === "active" && alert.status === "active") ||
      (statusFilter === "resolved" && alert.status === "resolved");

    return severityMatches && statusMatches;
  });
  const visibleSuggestions = suggestions
    .filter((suggestion) => {
      if (suggestionStatusFilter === "all") return true;
      return suggestion.status === suggestionStatusFilter;
    })
    .sort((left, right) => {
      const priorityWeight = { critical: 60, high: 45, medium: 25, low: 10 };
      const leftWeight =
        (priorityWeight[left.suggestedPriority] || 0) +
        (Number(left.occurrencesCount || 1) > 1 ? Math.min(Number(left.occurrencesCount || 1), 8) * 3 : 0);
      const rightWeight =
        (priorityWeight[right.suggestedPriority] || 0) +
        (Number(right.occurrencesCount || 1) > 1 ? Math.min(Number(right.occurrencesCount || 1), 8) * 3 : 0);

      if (rightWeight !== leftWeight) return rightWeight - leftWeight;
      return new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
    });
  const selectedSuggestionInfo = suggestions.find((suggestion) => suggestion.id === selectedSuggestionInfoId) || null;
  const selectedSuggestionVisibleIndex = visibleSuggestions.findIndex((suggestion) => suggestion.id === selectedSuggestionInfoId);
  const selectedSuggestionIndex = selectedSuggestionVisibleIndex >= 0
    ? selectedSuggestionVisibleIndex
    : Math.max(0, suggestions.findIndex((suggestion) => suggestion.id === selectedSuggestionInfoId));
  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical").length;
  const pendingSuggestions = suggestions.filter(canCreateServiceOrderFromSuggestion).length;
  const acceptedSuggestions = suggestions.filter((suggestion) => suggestion.status === "accepted").length;
  const recurringAlerts = alerts.filter((alert) => (alert.occurrencesCount || 0) >= 3).length;
  const machinesAtRisk = new Set(
    alerts
      .filter((alert) => alert.status !== "resolved")
      .map((alert) => alert.assetId || alert.hostId || alert.hostName)
      .filter(Boolean)
      .map(String)
  ).size;
  const resolvedAlerts = history.filter((alert) => alert.status === "resolved");
  const handledSuggestions = suggestions.filter((suggestion) => suggestion.status === "accepted" || suggestion.status === "rejected");
  const activeScripts = useMemo(
    () => scripts.filter((script) => script.active !== false),
    [scripts]
  );
  const selectedPreventiveAssetIds = useMemo(
    () => Array.from(selectedPreventiveAssets).map(String).sort(),
    [selectedPreventiveAssets]
  );
  const selectedPreventiveAssetKey = selectedPreventiveAssetIds.join("|");
  const canOpenSettings = canConfigureAlerts || canManageScripts;
  const priorityColorById = useMemo(
    () => ({
      ...defaultPriorityColors,
      ...(alertPriorityColors || {})
    }),
    [alertPriorityColors]
  );
  const deviceById = useMemo(
    () => new Map(devices.map((device) => [String(device.id), device])),
    [devices]
  );
  const segmentById = useMemo(
    () => new Map(segments.map((segment) => [String(segment.id), segment])),
    [segments]
  );
  const groupById = useMemo(
    () => new Map(segmentGroups.map((group) => [String(group.id), group])),
    [segmentGroups]
  );
  const tabById = useMemo(
    () => new Map(inventoryTabs.map((tab) => [String(tab.id), tab])),
    [inventoryTabs]
  );

  useEffect(() => {
    if (!token || !selectedPreventiveAssetIds.length) {
      setPreventiveScriptRecommendations((current) => {
        if (
          !current.loading &&
          !current.error &&
          current.recommended.length === 0 &&
          current.others.length === 0
        ) {
          return current;
        }
        return { recommended: [], others: [], loading: false, error: "" };
      });
      return undefined;
    }

    let ignore = false;
    setPreventiveScriptRecommendations((current) => ({
      ...current,
      loading: true,
      error: ""
    }));

    fetchMaintenanceScriptRecommendations(token, {
      assetIds: selectedPreventiveAssetIds,
      context: { source: "preventive_plan" }
    })
      .then((result) => {
        if (ignore) return;
        setPreventiveScriptRecommendations({
          recommended: result?.recommended || [],
          others: result?.others || [],
          loading: false,
          error: ""
        });
      })
      .catch((error) => {
        if (ignore) return;
        setPreventiveScriptRecommendations({
          recommended: [],
          others: activeScripts,
          loading: false,
          error: error.message || "Não foi possível carregar recomendações."
        });
      });

    return () => {
      ignore = true;
    };
  }, [activeScripts, token, selectedPreventiveAssetKey]);

  function findSuggestionDevice(suggestion) {
    if (suggestion.assetId && deviceById.has(String(suggestion.assetId))) {
      return deviceById.get(String(suggestion.assetId));
    }

    const machineLabel = getSuggestionMachineLabel(suggestion).toLowerCase();
    return devices.find((device) => {
      const names = [device.name, device.id, device.manualAsset?.hostname].filter(Boolean).map((value) => String(value).toLowerCase());
      return names.includes(machineLabel);
    }) || null;
  }

  function findAlertDevice(alert) {
    const identifiers = [alert.assetId, alert.hostId, alert.hostName].filter(Boolean).map(String);

    for (const id of identifiers) {
      if (deviceById.has(id)) return deviceById.get(id);
    }

    const hostLabel = String(alert.hostName || "").toLowerCase();
    return devices.find((device) => {
      const names = [device.name, device.id, device.manualAsset?.hostname].filter(Boolean).map((value) => String(value).toLowerCase());
      return names.includes(hostLabel);
    }) || null;
  }

  function getAlertLocation(alert) {
    const device = findAlertDevice(alert);
    const segment = device?.segmentId ? segmentById.get(String(device.segmentId)) : null;
    const groupId = segment?.groupId || device?.segmentGroupId || "";
    const group = groupId ? groupById.get(String(groupId)) : null;

    return {
      segmentName: segment?.name || device?.segmentName || "Não organizadas",
      groupName: group?.name || "Sem grupo"
    };
  }

  function getAlertMachineLabel(alert) {
    return alert.hostName || findAlertDevice(alert)?.name || alert.assetId || "Máquina não vinculada";
  }

  function getSuggestionLocation(suggestion) {
    const device = findSuggestionDevice(suggestion);
    const segment = device?.segmentId ? segmentById.get(String(device.segmentId)) : null;
    const groupId = segment?.groupId || device?.segmentGroupId || "";
    const group = groupId ? groupById.get(String(groupId)) : null;

    return {
      segmentName: segment?.name || device?.segmentName || "Não organizadas",
      groupName: group?.name || "Sem grupo"
    };
  }

  function getSuggestionAlertShape(suggestion) {
    return {
      id: suggestion.alertId,
      type: suggestion.alertType || suggestion.suggestedProblemTypeId,
      metric: suggestion.alertMetric,
      value: suggestion.alertValue,
      threshold: suggestion.alertThreshold,
      severity: suggestion.alertSeverity || (suggestion.suggestedPriority === "critical" ? "critical" : "warning"),
      status: suggestion.status,
      title: suggestion.title,
      description: suggestion.description,
      hostName: getSuggestionMachineLabel(suggestion),
      occurrencesCount: suggestion.occurrencesCount || 1,
      firstSeenAt: suggestion.alertFirstSeenAt || suggestion.createdAt,
      lastSeenAt: suggestion.alertLastSeenAt || suggestion.updatedAt || suggestion.createdAt,
      createdAt: suggestion.createdAt,
      updatedAt: suggestion.updatedAt
    };
  }

  function getSuggestionCorrelations(suggestion) {
    const machineLabel = getSuggestionMachineLabel(suggestion);
    return alertCorrelations.filter((correlation) => {
      const relatedAlerts = Array.isArray(correlation.relatedAlerts) ? correlation.relatedAlerts : [];
      const relatedHosts = Array.isArray(correlation.relatedHosts) ? correlation.relatedHosts : [];

      return (
        relatedHosts.includes(machineLabel) ||
        relatedAlerts.some((alert) => alert.id === suggestion.alertId || alert.hostName === machineLabel)
      );
    });
  }

  function getSuggestionInfoModel(suggestion) {
    if (!suggestion) return null;

    const alert = getSuggestionAlertShape(suggestion);
    const device = findSuggestionDevice(suggestion);
    const location = suggestion.location || getSuggestionLocation(suggestion);
    const priority = suggestion.suggestedPriority || "medium";
    const comments = Array.isArray(suggestion.comments) ? suggestion.comments : [];
    const checklist = Array.isArray(suggestion.checklist) ? suggestion.checklist : [];
    const correlations = getSuggestionCorrelations(suggestion);

    return {
      alert,
      device,
      location,
      priority,
      priorityLabel: priorityLabels[priority] || priorityLabels.medium,
      machineLabel: getSuggestionMachineLabel(suggestion),
      comments,
      checklist,
      correlations
    };
  }

  function getDevicePreventiveLocation(device) {
    const segment = device?.segmentId ? segmentById.get(String(device.segmentId)) : null;
    const groupId = segment?.groupId || device?.segmentGroupId || "";
    const group = groupId ? groupById.get(String(groupId)) : null;
    const tabId = device?.tabId || segment?.tabId || group?.tabId || "";
    const tab = tabId ? tabById.get(String(tabId)) : null;

    return {
      tabName: tab?.name || device?.tabName || device?.environment || "Ambiente atual",
      groupName: group?.name || "Sem grupo",
      segmentName: segment?.name || device?.segmentName || "Não organizadas",
      segmentId: segment?.id || device?.segmentId || "unorganized"
    };
  }

  function togglePreventiveAsset(assetId) {
    setSelectedPreventiveAssets((current) => {
      const next = new Set(current);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  }

  function togglePreventiveScript(scriptId) {
    setSelectedPreventiveScripts((current) => {
      const next = new Set(current);
      if (next.has(scriptId)) {
        next.delete(scriptId);
      } else {
        next.add(scriptId);
      }
      return next;
    });
  }

  function togglePreventiveScriptDetails(scriptId) {
    setExpandedPreventiveScripts((current) => {
      const next = new Set(current);
      if (next.has(scriptId)) {
        next.delete(scriptId);
      } else {
        next.add(scriptId);
      }
      return next;
    });
  }

  function togglePreventiveSegment(segmentId, assetIds) {
    setSelectedPreventiveAssets((current) => {
      const next = new Set(current);
      const allSelected = assetIds.every((assetId) => next.has(assetId));

      for (const assetId of assetIds) {
        if (allSelected) {
          next.delete(assetId);
        } else {
          next.add(assetId);
        }
      }

      return next;
    });
  }

  function openPreventiveReview() {
    if (!canCreatePreventivePlans || preventiveSaving || !selectedPreventiveAssets.size || !selectedPreventiveScripts.size) return;
    setPreventiveReviewOpen(true);
  }

  async function confirmPreventivePlanRegistration() {
    if (!onCreatePreventivePlan || preventiveSaving) return;
    const selectedScripts = activeScripts.filter((script) => selectedPreventiveScripts.has(script.id));
    const hasHighRiskScript = selectedScripts.some((script) => script.riskLevel === "high" || script.riskLevel === "critical");

    setPreventiveSaving(true);
    try {
      const createdPlan = await onCreatePreventivePlan({
        name: preventivePlanName,
        description: "Plano preventivo registrado pela tela de Avisos.",
        source: "manual",
        notes: "",
        riskAcknowledged: hasHighRiskScript,
        assetIds: [...selectedPreventiveAssets],
        scriptIds: [...selectedPreventiveScripts]
      });
      setSelectedPreventiveAssets(new Set());
      setSelectedPreventiveScripts(new Set());
      setExpandedPreventiveScripts(new Set());
      setLastCreatedPreventivePlan(createdPlan);
      setPreventiveReviewOpen(false);
    } finally {
      setPreventiveSaving(false);
    }
  }

  async function createPreventiveServiceOrder(plan) {
    if (!plan?.id || preventiveServiceOrderSavingId || !onCreatePreventivePlanServiceOrder) return;

    setPreventiveServiceOrderSavingId(plan.id);
    try {
      const result = await onCreatePreventivePlanServiceOrder(plan.id);
      if (result?.preventivePlan) {
        setLastCreatedPreventivePlan(result.preventivePlan);
      }
    } finally {
      setPreventiveServiceOrderSavingId(null);
    }
  }

  function openPreventiveServiceOrder() {
    if (onOpenServiceOrders) {
      onOpenServiceOrders();
    }
  }

  const preventiveDueDays = Number(priorityDraft.preventiveDueDays || alertPrioritySettings.preventiveDueDays || 180);

  function getLastPreventiveForAsset(assetId) {
    const matches = preventivePlans
      .filter((plan) =>
        Array.isArray(plan.assets) && plan.assets.some((asset) => String(asset.assetId) === String(assetId))
      )
      .map((plan) => {
        const asset = plan.assets.find((item) => String(item.assetId) === String(assetId));
        const date = asset?.preparedAt || plan.preparedAt || plan.createdAt;

        return {
          plan,
          asset,
          date,
          timestamp: new Date(date || 0).getTime()
        };
      })
      .sort((left, right) => right.timestamp - left.timestamp);

    return matches[0] || null;
  }

  function getDevicePreventiveInfo(device) {
    const location = getDevicePreventiveLocation(device);
    const lastPreventive = getLastPreventiveForAsset(device.id);
    const relatedAlerts = alerts.filter((alert) => {
      const alertDevice = findAlertDevice(alert);
      return alertDevice?.id === device.id && alert.status !== "resolved";
    });
    const criticalAlerts = relatedAlerts.filter((alert) => alert.severity === "critical").length;
    const isInMaintenance =
      Boolean(device.maintenance || device.maintenanceActive) ||
      device.maintenanceStatus === "active" ||
      isMaintenanceSegmentName(device.segmentName);
    const isBackup = Boolean(device.isBackup);
    const lastTimestamp = lastPreventive?.timestamp || null;
    const daysSinceLastPreventive = lastTimestamp
      ? Math.max(0, Math.floor((Date.now() - lastTimestamp) / 86400000))
      : null;
    const nextPreventiveDueAt = lastTimestamp
      ? new Date(lastTimestamp + preventiveDueDays * 86400000).toISOString()
      : null;
    const isOverdue = Number.isFinite(daysSinceLastPreventive) && daysSinceLastPreventive > preventiveDueDays;
    let preventiveStatus = "up_to_date";
    let preventiveStatusLabel = "Preventiva em dia";
    let urgency = 10;

    if (!lastPreventive) {
      preventiveStatus = "no_preventive";
      preventiveStatusLabel = "Sem preventiva";
      urgency = 70;
    } else if (isOverdue) {
      preventiveStatus = "overdue";
      preventiveStatusLabel = "Preventiva vencida";
      urgency = 82;
    }

    if (relatedAlerts.length) urgency = Math.max(urgency, 62);
    if (criticalAlerts) {
      preventiveStatus = "critical";
      preventiveStatusLabel = "Crítica";
      urgency = 100;
    }
    if (isInMaintenance) urgency = Math.max(urgency, 90);
    if (isBackup && !criticalAlerts && !isInMaintenance) urgency = Math.min(urgency, 20);

    const badges = [
      {
        label: preventiveStatusLabel,
        tone: preventiveStatus === "up_to_date" ? "ok" : preventiveStatus === "critical" ? "danger" : "warning"
      }
    ];

    if (relatedAlerts.length) {
      badges.push({
        label: `${relatedAlerts.length} aviso(s)`,
        tone: criticalAlerts ? "danger" : "warning"
      });
    }
    if (isInMaintenance) badges.push({ label: "Em manutenção", tone: "warning" });
    if (isBackup) badges.push({ label: "Backup", tone: "neutral" });

    return {
      device,
      location,
      lastPreventive,
      activeAlertsCount: relatedAlerts.length,
      criticalAlertsCount: criticalAlerts,
      isInMaintenance,
      isBackup,
      isOverdue,
      preventiveStatus,
      preventiveStatusLabel,
      nextPreventiveDueAt,
      daysSinceLastPreventive,
      urgency,
      badges
    };
  }

  const automationMachinesById = new Map(
    (preventiveAutomationManagement?.machines || []).map((machine) => [
      String(machine.assetId),
      machine
    ])
  );
  const preventiveDevicesWithAutomation = devices.map((device) => {
    const managementMachine = automationMachinesById.get(String(device.id));
    const indicatorsByPlanId = new Map();

    for (const indicator of [
      ...(device.automationIndicators || []),
      ...(managementMachine?.plans || [])
    ]) {
      const planId = indicator.automationPlanId || indicator.id;
      if (planId) indicatorsByPlanId.set(String(planId), indicator);
    }

    return {
      ...device,
      automationIndicators: [...indicatorsByPlanId.values()]
    };
  });
  const preventiveOverview = preventiveDevicesWithAutomation.map(getDevicePreventiveInfo);
  const preventiveSummary = preventiveOverview.reduce(
    (summary, item) => {
      if (item.preventiveStatus === "no_preventive") summary.withoutPreventive += 1;
      if (item.isOverdue) summary.overdue += 1;
      if (item.preventiveStatus === "up_to_date") summary.upToDate += 1;
      if (item.activeAlertsCount) summary.withAlerts += 1;
      return summary;
    },
    { withoutPreventive: 0, overdue: 0, upToDate: 0, withAlerts: 0 }
  );

  const preventiveDevices = preventiveOverview.filter((item) => {
    const { device, location } = item;
    const term = normalizeText(preventiveSearch);
    const matchesFilter =
      preventiveFilter === "all" ||
      (preventiveFilter === "no_preventive" && item.preventiveStatus === "no_preventive") ||
      (preventiveFilter === "overdue" && item.isOverdue) ||
      (preventiveFilter === "up_to_date" && item.preventiveStatus === "up_to_date") ||
      (preventiveFilter === "alerts" && item.activeAlertsCount > 0) ||
      (preventiveFilter === "maintenance" && item.isInMaintenance) ||
      (preventiveFilter === "backup" && item.isBackup);

    if (!matchesFilter) return false;
    if (!term) return true;

    return [
      device.name,
      device.id,
      device.ip,
      device.statusLabel,
      device.type,
      device.assetType,
      location.tabName,
      location.groupName,
      location.segmentName,
      item.preventiveStatusLabel,
      item.lastPreventive?.plan?.name
    ]
      .filter(Boolean)
      .some((value) => normalizeText(value).includes(term));
  }).sort((left, right) => {
    if (right.urgency !== left.urgency) return right.urgency - left.urgency;
    return String(left.device.name || left.device.id).localeCompare(String(right.device.name || right.device.id));
  });

  const preventiveGroups = preventiveDevices.reduce((groups, device) => {
    const location = device.location;
    const key = `${location.tabName}::${location.groupName}::${location.segmentName}`;
    const current = groups.get(key) || {
      key,
      ...location,
      devices: []
    };
    current.devices.push(device);
    groups.set(key, current);
    return groups;
  }, new Map());
  const selectedPreventiveDevices = preventiveDevicesWithAutomation.filter((device) =>
    selectedPreventiveAssets.has(device.id)
  );
  const recommendedPreventiveScripts = preventiveScriptRecommendations.recommended || [];
  const preventiveScriptBaseList = preventiveScriptRecommendations.others?.length
    ? preventiveScriptRecommendations.others
    : activeScripts;
  const orderedPreventiveScripts = [
    ...recommendedPreventiveScripts,
    ...preventiveScriptBaseList.filter((script) =>
      !recommendedPreventiveScripts.some((recommended) => recommended.id === script.id)
    )
  ];
  const selectedPreventiveScriptList = activeScripts.filter((script) => selectedPreventiveScripts.has(script.id));
  const selectedPreventiveRiskList = selectedPreventiveScriptList.filter((script) =>
    script.riskLevel === "high" || script.riskLevel === "critical"
  );
  const preventivePlanCount = preventivePlans.length;
  const automatedPreventivePlanCount = preventiveAutomationPlans.filter((plan) => plan.active !== false).length;

  function openPreventiveAutomationFromSelection() {
    const selectedDeviceNames = selectedPreventiveDevices
      .map((device) => device.name || device.hostname || device.id)
      .filter(Boolean);
    const selectedScriptNames = selectedPreventiveScriptList
      .map((script) => script.name || script.id)
      .filter(Boolean);
    const selectionKey = [
      ...selectedPreventiveDevices.map((device) => device.id).sort(),
      "|",
      ...selectedPreventiveScriptList.map((script) => script.id).sort()
    ].join(":");
    const assetIds = selectedPreventiveDevices.map((device) => device.id).filter(Boolean);

    setPreventiveAutomationCreateRequest({
      id: Date.now(),
      defaults: {
        name: preventivePlanName || "Plano preventivo automatizado",
        description: selectedDeviceNames.length
          ? `Automação criada a partir da seleção preventiva: ${selectedDeviceNames.slice(0, 6).join(", ")}${selectedDeviceNames.length > 6 ? "..." : ""}.`
          : "Automação criada a partir do fluxo de preventivas.",
        defaultScriptIds: selectedPreventiveScriptList.map((script) => script.id),
        context: {
          selectionKey,
          assetCount: selectedPreventiveDevices.length,
          assetNames: selectedDeviceNames,
          assetIds,
          scriptNames: selectedScriptNames,
          riskCount: selectedPreventiveRiskList.length
        },
        scopeType: "asset_list",
        scopeId: "",
        assetIds
      }
    });
  }

  async function createAutomatedPreventivePlanFromSelection(automationPayload) {
    const assetIds = selectedPreventiveDevices.map((device) => device.id).filter(Boolean);
    const scriptIds = selectedPreventiveScriptList.map((script) => script.id).filter(Boolean);
    const planName = automationPayload.name || preventivePlanName || "Plano preventivo automatizado";

    const createdPlan = await onCreatePreventivePlan({
      name: planName,
      description: automationPayload.description || "",
      source: "automated",
      notes: automationPayload.notes || automationPayload.description || "",
      status: "prepared",
      riskAcknowledged: true,
      assetIds,
      scriptIds,
      automation: {
        ...automationPayload,
        enabled: true,
        name: planName,
        scopeType: "asset_list",
        scopeId: null,
        assetIds,
        defaultScriptIds: scriptIds
      }
    });

    setSelectedPreventiveAssets(new Set());
    setSelectedPreventiveScripts(new Set());
    setPreventiveScriptRecommendations({ recommended: [], others: [], loading: false, error: "" });
    setPreventiveAutomationCreateRequest(null);
    return createdPlan;
  }

  function toggleAlertSettingsSection(section) {
    setSettingsSectionsOpen((current) => ({
      ...current,
      [section]: !current[section]
    }));
  }

  function updatePriorityDraft(section, field, value) {
    setPriorityDraft((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value
      }
    }));
  }

  function updateAlertOperationalDraft(field, value) {
    setPriorityDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function changePriorityDraftColor(priority, color) {
    setPriorityDraft((current) => ({
      ...current,
      priorityColors: {
        ...current.priorityColors,
        [priority]: color
      }
    }));
  }

  async function savePriorityDraft() {
    if (!onSaveAlertPrioritySettings) return;
    setPrioritySaving(true);
    try {
      const normalized = normalizePrioritySettings(priorityDraft);
      const saved = await onSaveAlertPrioritySettings(normalized);
      setPriorityDraft(normalizePrioritySettings(saved || normalized));
    } finally {
      setPrioritySaving(false);
    }
  }

  function getSuggestionLatestValidation(suggestion) {
    return suggestion?.latestValidation || null;
  }

  function openScriptLogPreview() {
    const latestValidationWithLog = suggestions
      .map((suggestion) => getSuggestionLatestValidation(suggestion))
      .find((validation) => validation?.log);

    if (latestValidationWithLog?.log) {
      setSelectedScriptLog({
        ...latestValidationWithLog.log,
        scriptName: latestValidationWithLog.scriptName,
        validationStatus: latestValidationWithLog.status,
        validationId: latestValidationWithLog.id
      });
      return;
    }

    window.alert("Nenhum log de script disponível.");
    return;
  }

  async function toggleSuggestionScriptMenu(suggestionId) {
    setOpenScriptMenuSuggestionId((current) => (current === suggestionId ? null : suggestionId));

    if (
      openScriptMenuSuggestionId === suggestionId ||
      scriptRecommendationsBySuggestion[suggestionId]?.recommended ||
      loadingScriptRecommendationId === suggestionId
    ) {
      return;
    }

    setLoadingScriptRecommendationId(suggestionId);
    try {
      const result = await fetchSuggestionRecommendedScripts(token, suggestionId);
      setScriptRecommendationsBySuggestion((current) => ({
        ...current,
        [suggestionId]: {
          recommended: result?.recommended || [],
          others: result?.others || []
        }
      }));
    } catch (error) {
      setScriptRecommendationsBySuggestion((current) => ({
        ...current,
        [suggestionId]: {
          recommended: [],
          others: activeScripts,
          error: activeScripts.length ? "" : error.message || "Não foi possível carregar os scripts."
        }
      }));
    } finally {
      setLoadingScriptRecommendationId(null);
    }
  }

  async function handleUseSuggestionScript(suggestion, script) {
    const scriptUseKey = `${suggestion.id}:${script.id}`;
    if (usingSuggestionScriptKey === scriptUseKey) return;
    const baseConfirmation =
      "Esta ação apenas registrará o uso do script na sugestão e iniciará a observação. Nenhum comando será executado na máquina ou no servidor.";
    const highRisk = script.riskLevel === "high" || script.riskLevel === "critical";

    if (!window.confirm(baseConfirmation)) return;

    if (highRisk) {
      const riskConfirmation =
        "Este script foi marcado como alto risco. A execução real não está disponível nesta versão. Deseja apenas registrar a observação preparada?";
      if (!window.confirm(riskConfirmation)) return;
    }

    setUsingSuggestionScriptKey(scriptUseKey);
    try {
      await onUseSuggestionScript(suggestion.id, script.id, {
        mode: "prepared",
        confirmed: true,
        riskAcknowledged: highRisk,
        validationWindowMinutes: priorityDraft.scriptValidationWindowMinutes,
        notes: `Script selecionado no card ${formatSuggestionCode(suggestion)}. Nenhum comando foi executado.`
      });
      setOpenScriptMenuSuggestionId(null);
    } finally {
      setUsingSuggestionScriptKey("");
    }
  }

  async function submitAlertComment(alertId) {
    const message = String(commentDrafts[alertId] || "").trim();
    if (!message || !onAddAlertComment) return;
    await onAddAlertComment(alertId, message);
    setCommentDrafts((current) => ({ ...current, [alertId]: "" }));
  }

  const selectedSuggestionInfoModel = getSuggestionInfoModel(selectedSuggestionInfo);

  return (
    <section className="view-stack alerts-view-v2">
      {(canViewAlerts || canViewPreventivePlans || canViewPreventiveAutomation) && (
        <>
          {canViewAlerts && alertActiveTab === "suggestions" && (
            <div className="alerts-view-header">
              <section className="summary-grid compact-summary alerts-summary">
                <SummaryCard icon={Bell} label="Avisos ativos" value={alerts.length} tone="warning" />
                <SummaryCard icon={AlertTriangle} label="Críticos" value={criticalAlerts} tone="danger" />
                <SummaryCard icon={ClipboardList} label="Sugestões pendentes" value={pendingSuggestions} tone="warning" />
                <SummaryCard icon={CheckCircle} label="OS criadas por aviso" value={acceptedSuggestions} tone="ok" />
                <SummaryCard icon={RefreshCw} label="Avisos recorrentes" value={recurringAlerts} tone="info" />
                <SummaryCard icon={Monitor} label="Máquinas em risco" value={machinesAtRisk} tone="danger" />
              </section>
            </div>
          )}

          {canUsePreventiveArea && alertActiveTab === "preventives" && (
            <div className="alerts-view-header preventive-summary-header">
              <section className="summary-grid compact-summary alerts-summary preventive-summary-grid" aria-label="Resumo preventivo">
                <SummaryCard icon={ClipboardList} label="Sem preventiva" value={preventiveSummary.withoutPreventive} tone="info" />
                <SummaryCard icon={AlertTriangle} label="Preventivas vencidas" value={preventiveSummary.overdue} tone="danger" />
                <SummaryCard icon={CheckCircle} label="Preventivas em dia" value={preventiveSummary.upToDate} tone="ok" />
                <SummaryCard icon={Bell} label="Com avisos ativos" value={preventiveSummary.withAlerts} tone="warning" />
                <SummaryCard icon={ClipboardList} label="Planos registrados" value={preventivePlanCount} tone="info" />
                <SummaryCard icon={RefreshCw} label="Planos automatizados" value={automatedPreventivePlanCount} tone="info" />
              </section>
            </div>
          )}

          <nav className="alerts-internal-tabs" aria-label="Áreas da Central de Avisos">
            {canViewAlerts && (
              <button
                type="button"
                className={alertActiveTab === "suggestions" ? "active" : ""}
                onClick={() => setAlertActiveTab("suggestions")}
              >
                Sugestões de OS
              </button>
            )}
            {canUsePreventiveArea && (
              <button
                type="button"
                className={alertActiveTab === "preventives" ? "active" : ""}
                onClick={() => setAlertActiveTab("preventives")}
              >
                Preventivas
              </button>
            )}
            {canShowAutomationManagement && (
              <button
                type="button"
                className={alertActiveTab === "automation" ? "active" : ""}
                onClick={() => setAlertActiveTab("automation")}
              >
                Automatizações
              </button>
            )}
            {canViewScriptLogs && (
              <button
                type="button"
                className="icon-button alerts-log-tab-button"
                onClick={openScriptLogPreview}
                title="Abrir tela de log"
                aria-label="Abrir tela de log"
              >
                <Plus size={18} />
              </button>
            )}
            {canOpenSettings && (
              <button
                type="button"
                className="icon-button alerts-settings-trigger alerts-settings-tab-button"
                onClick={() => setSettingsOpen(true)}
                title="Configurações de aviso"
                aria-label="Configurações de aviso"
              >
                <SettingsIcon size={18} />
              </button>
            )}
          </nav>

          {alertActiveTab === "active" && (
            <section className="panel alerts-diagnostics-panel">
              <div className="panel-heading">
                <div>
                  <h2>Avisos ativos</h2>
                  <p>Diagnóstico preventivo com impacto, evidência e ação recomendada.</p>
                </div>
                {canManageSuggestions && (
                  <button type="button" className="primary-action compact-action" onClick={onEvaluateAlerts}>
                    Avaliar recorrência
                  </button>
                )}
              </div>
              {alertCorrelations.length > 0 && (
                <section className="alert-correlations-section" aria-label="Avisos correlacionados">
                  <header>
                    <div>
                      <h3>Avisos correlacionados</h3>
                      <p>Padrões agrupados por tipo, grupo e segmento para apoiar a triagem.</p>
                    </div>
                  </header>
                  <div className="alert-correlations-grid">
                    {alertCorrelations.slice(0, 4).map((correlation) => (
                      <article key={correlation.correlationId || correlation.id} className={`alert-correlation-card ${correlation.impactLevel === "critical" ? "critical" : "warning"}`}>
                        <span>{correlation.confidenceLevel || "Média"} confiança</span>
                        <strong>{correlation.correlationSummary}</strong>
                        <small>{(correlation.relatedHosts || []).join(", ")}</small>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              <div className="alert-board alert-diagnostics-board">
                {visibleAlerts
                  .filter((alert) => alert.status !== "resolved")
                  .map((alert) => {
                    const location = alert.location || getAlertLocation(alert);
                    const machineLabel = getAlertMachineLabel(alert);
                    const comments = Array.isArray(alert.comments) ? alert.comments : [];
                    const checklist = Array.isArray(alert.checklist) ? alert.checklist : [];

                    return (
                      <article key={alert.id} className={`alert-diagnostic-card ${alert.severity}`}>
                        <header>
                          <div>
                            <span>{alert.category || getAlertCategory(alert)}</span>
                            <h3>{alert.title}</h3>
                            <small>{machineLabel} · {location.groupName} · {location.segmentName}</small>
                          </div>
                          <span className={`pill ${alert.severity === "critical" ? "danger" : "warning"}`}>
                            {alert.severity === "critical" ? "Crítico" : "Atenção"}
                          </span>
                        </header>
                        <dl>
                          <div>
                            <dt>Valor atual</dt>
                            <dd>{formatAlertValue(alert)}</dd>
                          </div>
                          <div>
                            <dt>Limite</dt>
                            <dd>{formatAlertThreshold(alert)}</dd>
                          </div>
                          <div>
                            <dt>Ocorrências</dt>
                            <dd>{alert.occurrencesCount || 1}</dd>
                          </div>
                          <div>
                            <dt>Confiança</dt>
                            <dd>{alert.confidenceLevel || getAlertConfidence(alert)}</dd>
                          </div>
                          <div>
                            <dt>Tendência</dt>
                            <dd>{alert.trend || getAlertTrend(alert)}</dd>
                          </div>
                          <div>
                            <dt>Score</dt>
                            <dd>{Math.round(alert.recurrenceScore || 0) || "N/D"}</dd>
                          </div>
                        </dl>
                        <p><strong>Motivo da prioridade:</strong> {alert.priorityReason || "Prioridade definida pela regra atual do aviso."}</p>
                        <p><strong>Impacto:</strong> {alert.operationalImpact || getAlertImpact(alert)}</p>
                        <p><strong>Causa provável:</strong> {alert.probableCause || getAlertProbableCause(alert)}</p>
                        <p><strong>Ação recomendada:</strong> {alert.recommendedAction || getAlertRecommendedAction(alert)}</p>
                        {alert.recurrenceInsight && (
                          <p><strong>Reincidência:</strong> {alert.recurrenceInsight.summary}</p>
                        )}
                        {alert.falsePositiveInsight && (
                          <p><strong>Possível falso positivo:</strong> {alert.falsePositiveInsight.summary}</p>
                        )}
                        {alert.capacityForecast?.summary && (
                          <p><strong>Capacidade:</strong> {alert.capacityForecast.summary}</p>
                        )}
                        {!!checklist.length && (
                          <div className="alert-checklist">
                            <strong>Checklist sugerido</strong>
                            <ul>
                              {checklist.slice(0, 4).map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="alert-comments">
                          <strong>Comentários internos</strong>
                          {comments.slice(-2).map((comment) => (
                            <p key={comment.id}>
                              <span>{comment.userName || "Usuário"} · {formatDate(comment.createdAt)}</span>
                              {comment.message}
                            </p>
                          ))}
                          {!comments.length && <small>Nenhum comentário registrado.</small>}
                          {canCommentAlerts && (
                            <div className="alert-comment-form">
                              <input
                                value={commentDrafts[alert.id] || ""}
                                onChange={(event) => setCommentDrafts((current) => ({ ...current, [alert.id]: event.target.value }))}
                                placeholder="Adicionar comentário interno"
                              />
                              <button type="button" className="secondary-action compact-action" onClick={() => submitAlertComment(alert.id)}>
                                Comentar
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                {!visibleAlerts.filter((alert) => alert.status !== "resolved").length && (
                  <p className="empty">Nenhum aviso ativo encontrado para os filtros atuais.</p>
                )}
              </div>
            </section>
          )}

          {alertActiveTab === "suggestions" && (
          <section className="alerts-workspace-grid">
            <section className="panel suggestions-panel">
              <div className="panel-heading">
                <div>
                  <h2>Sugestões de OS</h2>
                  <p>Aviso recorrente só vira Ordem de Serviço quando alguém aceita a sugestão.</p>
                </div>
                <ClipboardList size={18} />
              </div>
              <div className="toolbar inline-toolbar">
                <select value={suggestionStatusFilter} onChange={(event) => setSuggestionStatusFilter(event.target.value)}>
                  <option value="all">Todas as sugestões</option>
                  <option value="pending">Pendentes</option>
                  <option value="accepted">Aceitas</option>
                  <option value="rejected">Recusadas</option>
                  <option value="observed_resolved">Observadas como normalizadas</option>
                  <option value="observed_persistent">Observadas como persistentes</option>
                  <option value="validation_cancelled">Observações canceladas</option>
                </select>
              </div>
              <div className="alert-board suggestion-board">
                {visibleSuggestions.map((suggestion, index) => {
                  const machineLabel = getSuggestionMachineLabel(suggestion);
                  const location = suggestion.location || getSuggestionLocation(suggestion);
                  const priority = suggestion.suggestedPriority || "medium";
                  const priorityLabel = priorityLabels[priority] || priorityLabels.medium;
                  const priorityColor = priorityColorById[priority] || priorityColorById.medium;
                  const locationLabel = `${location.groupName} • ${location.segmentName}`;
                  const occurrenceCount = Number(suggestion.occurrencesCount || 1);
                  const scriptRecommendationState = scriptRecommendationsBySuggestion[suggestion.id] || {};
                  const recommendedScripts = scriptRecommendationState.recommended || [];
                  const otherScripts = scriptRecommendationState.others || [];
                  const recommendationError = scriptRecommendationState.error || "";
                  const recommendationLoading = loadingScriptRecommendationId === suggestion.id;

                  const latestValidation = getSuggestionLatestValidation(suggestion);
                  const validationStatus = latestValidation?.status || "";
                  const hasPendingScriptLog = Boolean(
                    latestValidation?.log?.attentionRequired && !latestValidation.log.acknowledgedAt
                  );

                  return (
                    <article
                      key={suggestion.id}
                      className="service-order-card suggestion-card"
                      style={{
                        "--service-order-priority-color": priorityColor,
                        "--service-order-priority-bg": `color-mix(in srgb, ${priorityColor} 32%, var(--surface))`
                      }}
                      title={suggestion.priorityReason || suggestion.title}
                    >
                      {occurrenceCount > 1 && (
                        <span
                          className="suggestion-recurrence-indicator"
                          title={`Este aviso ocorreu ${occurrenceCount} vezes no período configurado.`}
                        >
                          <RefreshCw size={12} />
                          {occurrenceCount}x
                        </span>
                      )}
                      {latestValidation && (
                        <span
                          className={`suggestion-validation-indicator ${validationStatus}`}
                          title={getScriptValidationTooltip(latestValidation)}
                        >
                          {["observed_resolved", "execution_success", "validation_success"].includes(validationStatus)
                            ? <CheckCircle size={13} />
                            : ["observed_persistent", "execution_failed", "insufficient_data", "validation_failed"].includes(validationStatus)
                              ? <AlertTriangle size={13} />
                              : <SettingsIcon size={13} />}
                        </span>
                      )}
                      <span>{formatSuggestionCode(suggestion, index)}</span>
                      <strong title={suggestion.title}>{suggestion.title}</strong>
                      <small title={machineLabel}>{machineLabel}</small>
                      <small className="suggestion-card-location" title={locationLabel}>{locationLabel}</small>
                      <div className="suggestion-card-badges">
                        <em title={priorityLabel}>{priorityLabel}</em>
                        <em title="Preventiva">Preventiva</em>
                      </div>
                      <footer>
                        <ClipboardList size={14} />
                        <span title="Sistema">Sistema</span>
                        <time>{formatDate(suggestion.createdAt)}</time>
                      </footer>
                      <div className="suggestion-actions">
                        {canManageSuggestions && (canCreateServiceOrderFromSuggestion(suggestion) || canRejectSuggestion(suggestion)) && (
                          <>
                            {canCreateServiceOrderFromSuggestion(suggestion) && (
                              <button type="button" className="primary-action compact-action" onClick={() => onAcceptSuggestion(suggestion.id)}>
                                Criar OS
                              </button>
                            )}
                            {canRejectSuggestion(suggestion) && (
                              <button
                                type="button"
                                className="danger-action compact-action suggestion-reject-trigger"
                                onClick={() => onRejectSuggestion(suggestion.id)}
                                title="Recusar"
                                aria-label="Recusar"
                              >
                                <XCircle size={15} />
                              </button>
                            )}
                          </>
                        )}
                        <button
                          type="button"
                          className="icon-button suggestion-info-trigger"
                          title="Ver detalhes do aviso"
                          aria-label="Ver detalhes do aviso"
                          onClick={() => {
                            setOpenScriptMenuSuggestionId(null);
                            setSelectedSuggestionInfoId(suggestion.id);
                          }}
                        >
                          <Info size={15} />
                        </button>
                        {hasPendingScriptLog && canViewScriptLogs && (
                          <button
                            type="button"
                            className="icon-button suggestion-log-trigger"
                            title="Ver log do script"
                            aria-label="Ver log do script"
                            onClick={() => {
                              setOpenScriptMenuSuggestionId(null);
                              setSelectedScriptLog({
                                ...latestValidation.log,
                                scriptName: latestValidation.scriptName,
                                validationStatus: latestValidation.status,
                                validationId: latestValidation.id
                              });
                            }}
                          >
                            <AlertTriangle size={15} />
                          </button>
                        )}
                        {canManageSuggestions && canUseScriptOnSuggestion(suggestion) && canViewScripts && (
                            <div className="suggestion-script-menu">
                              <button
                                type="button"
                                className="icon-button suggestion-script-trigger"
                                title="Scripts disponíveis"
                                aria-label="Scripts disponíveis"
                                onClick={() => toggleSuggestionScriptMenu(suggestion.id)}
                              >
                                <KeyRound size={15} />
                              </button>
                              {openScriptMenuSuggestionId === suggestion.id && (
                                <div className="suggestion-script-popover">
                                  <strong>Scripts disponíveis</strong>
                                  {recommendationLoading && <p>Carregando scripts...</p>}
                                  {recommendationError && <p>{recommendationError}</p>}
                                  {!!recommendedScripts.length && (
                                    <section>
                                      <em>Recomendado</em>
                                      {recommendedScripts.map((script) => (
                                        <button
                                          key={script.id}
                                          type="button"
                                          disabled={!canUseScriptsFromAlerts || usingSuggestionScriptKey === `${suggestion.id}:${script.id}`}
                                          onClick={() => handleUseSuggestionScript(suggestion, script)}
                                        >
                                          <span>{script.name}</span>
                                          <small>{script.recommendationReason || script.estimatedSummary || "Registro manual"}</small>
                                        </button>
                                      ))}
                                    </section>
                                  )}
                                  {!!otherScripts.length && (
                                    <section>
                                      <em>Outros scripts disponíveis</em>
                                      {otherScripts.map((script) => (
                                        <button
                                          key={script.id}
                                          type="button"
                                          disabled={!canUseScriptsFromAlerts || usingSuggestionScriptKey === `${suggestion.id}:${script.id}`}
                                          onClick={() => handleUseSuggestionScript(suggestion, script)}
                                        >
                                          <span>{script.name}</span>
                                          <small>{script.estimatedSummary || script.category || "Registro manual"}</small>
                                        </button>
                                      ))}
                                    </section>
                                  )}
                                  {!recommendationLoading && !recommendedScripts.length && !otherScripts.length && !recommendationError && (
                                    <p>Nenhum script ativo cadastrado.</p>
                                  )}
                                </div>
                              )}
                            </div>
                        )}
                      </div>
                    </article>
                  );
                })}
                {!visibleSuggestions.length && <p className="empty">Nenhuma sugestão encontrada para os filtros atuais.</p>}
              </div>
            </section>

            <section className="panel alerts-compact-panel">
              <div className="panel-heading">
                <div>
                  <h2>Central de avisos</h2>
                  <p>Resumo dos avisos simulados.</p>
                </div>
                <Bell size={18} />
              </div>
              <div className="toolbar inline-toolbar">
                <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
                  <option value="all">Todas</option>
                  <option value="critical">Críticos</option>
                  <option value="warning">Atenção</option>
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="resolved">Resolvidos</option>
                </select>
                {canManageSuggestions && (
                  <button type="button" className="primary-action compact-action" onClick={onEvaluateAlerts}>
                    Avaliar
                  </button>
                )}
              </div>
              <div className="alert-board compact-alert-board">
                {visibleAlerts.map((alert) => (
                  <article key={alert.id} className={`alert-card compact-alert-card ${alert.severity}`}>
                    <div>
                      <span className={`pill ${alert.status === "resolved" ? "ok" : "warning"}`}>
                        {alert.status === "resolved" ? "Resolvido" : "Ativo"}
                      </span>
                      <span className={`pill ${alert.severity === "critical" ? "danger" : "warning"}`}>
                        {alert.severity === "critical" ? "Crítico" : "Atenção"}
                      </span>
                    </div>
                    <h3>{alert.title}</h3>
                    <p>{alert.hostName} · {formatAlertValue(alert)}</p>
                    <small>{alertTypeLabels[alert.type] || alert.type || alert.metric}</small>
                  </article>
                ))}
                {!visibleAlerts.length && <p className="empty">Nenhum aviso encontrado para os filtros atuais.</p>}
              </div>
            </section>
          </section>
          )}

          {alertActiveTab === "preventives" && canUsePreventiveArea && (
            <section className="panel preventive-plans-panel">
              <div className="panel-heading">
                <div>
                  <h2>Preventivas</h2>
                </div>
                <ClipboardList size={18} />
              </div>

              {lastCreatedPreventivePlan && (
                <section className="preventive-created-summary">
                  <div>
                    <span>Plano registrado</span>
                    <strong>{lastCreatedPreventivePlan.name}</strong>
                    <small>
                      {lastCreatedPreventivePlan.assets?.length || 0} máquina(s) •{" "}
                      {lastCreatedPreventivePlan.scripts?.length || 0} verificação(ões) •{" "}
                      {formatDate(lastCreatedPreventivePlan.preparedAt || lastCreatedPreventivePlan.createdAt)}
                    </small>
                  </div>
                  {lastCreatedPreventivePlan.serviceOrderId ? (
                    <button type="button" className="secondary-action compact-action" onClick={openPreventiveServiceOrder}>
                      Abrir OS preventiva
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary-action compact-action"
                      disabled={!canCreatePreventiveServiceOrder || preventiveServiceOrderSavingId === lastCreatedPreventivePlan.id}
                      onClick={() => createPreventiveServiceOrder(lastCreatedPreventivePlan)}
                    >
                      {preventiveServiceOrderSavingId === lastCreatedPreventivePlan.id ? "Criando OS..." : "Criar OS preventiva"}
                    </button>
                  )}
                </section>
              )}

              <div className={`preventive-workspace ${selectedPreventiveAssets.size ? "has-selection" : "single-step"}`}>
                <section className="preventive-device-groups" aria-label="Máquinas para preventiva">
                  <div className="preventive-step-header">
                    <span>Etapa 1</span>
                    <div>
                      <strong>Selecionar máquinas</strong>
                    </div>
                  </div>
                  <div className="preventive-toolbar">
                    <label className="compact-search preventive-search">
                      <Search size={16} />
                      <input
                        value={preventiveSearch}
                        onChange={(event) => setPreventiveSearch(event.target.value)}
                        placeholder="Buscar máquina, grupo, segmento ou ambiente"
                      />
                    </label>
                    <select
                      className="preventive-status-filter"
                      value={preventiveFilter}
                      onChange={(event) => setPreventiveFilter(event.target.value)}
                      aria-label="Filtrar status preventivo"
                    >
                      <option value="all">Todas</option>
                      <option value="no_preventive">Sem preventiva</option>
                      <option value="overdue">Vencida</option>
                      <option value="up_to_date">Em dia</option>
                      <option value="alerts">Com avisos</option>
                      <option value="maintenance">Em manutenção</option>
                      <option value="backup">Backup</option>
                    </select>
                    <div className="preventive-plan-summary">
                      <strong>{selectedPreventiveAssets.size}</strong>
                      <span>
                        {selectedPreventiveAssets.size === 1
                          ? "máquina selecionada"
                          : "máquinas selecionadas"}
                      </span>
                    </div>
                  </div>

                  <div className="preventive-group-list">
                    {Array.from(preventiveGroups.values()).map((group) => {
                      const assetIds = group.devices.map((item) => item.device.id);
                      const selectedCount = assetIds.filter((assetId) => selectedPreventiveAssets.has(assetId)).length;

                      return (
                        <section key={group.key} className="preventive-device-group">
                          <header>
                            <div>
                              <strong>{group.groupName} • {group.segmentName}</strong>
                              <small>
                                {group.devices.length} {group.devices.length === 1 ? "máquina" : "máquinas"} neste segmento
                              </small>
                            </div>
                            <button
                              type="button"
                              className="secondary-action compact-action"
                              disabled={!canCreatePreventivePlans}
                              onClick={() => togglePreventiveSegment(group.segmentId, assetIds)}
                            >
                              {selectedCount === assetIds.length ? "Remover segmento" : "Selecionar segmento"}
                            </button>
                          </header>

                          <div className="preventive-device-list">
                            {group.devices.map((item) => {
                              const { device, badges, nextPreventiveDueAt, daysSinceLastPreventive } = item;
                              const lastPreventive = item.lastPreventive
                                ? {
                                    ...item.lastPreventive.plan,
                                    preparedAt: item.lastPreventive.date,
                                    createdAt: item.lastPreventive.date
                                  }
                                : null;
                              const isSelected = selectedPreventiveAssets.has(device.id);
                              const nextPreventiveLabel = nextPreventiveDueAt
                                ? `Próxima sugerida: ${formatDate(nextPreventiveDueAt)}`
                                : `Vence após ${preventiveDueDays} dia(s) da primeira preventiva`;
                              const normalizedDeviceStatus = normalizeText(`${device.statusLabel || ""} ${device.status || ""}`);
                              const hasPreventiveError =
                                item.criticalAlertsCount > 0 ||
                                badges.some((badge) => badge.tone === "danger") ||
                                normalizedDeviceStatus.includes("erro") ||
                                normalizedDeviceStatus.includes("offline");

                              return (
                                <button
                                  key={device.id}
                                  type="button"
                                  className={[
                                    "preventive-device-row",
                                    isSelected ? "selected" : "",
                                    hasPreventiveError ? "has-error" : ""
                                  ].filter(Boolean).join(" ")}
                                  disabled={!canCreatePreventivePlans}
                                  onClick={() => togglePreventiveAsset(device.id)}
                                >
                                  <span className="preventive-device-check" aria-hidden="true">
                                    {isSelected ? "✓" : ""}
                                  </span>
                                  <span>
                                    <strong>{device.name || device.id}</strong>
                                    <small>{device.type || device.assetType || "Ativo"} • {device.statusLabel || device.status || "Sem status"}</small>
                                  </span>
                                  <em>
                                    {lastPreventive ? `Última preventiva: ${formatDate(lastPreventive.preparedAt || lastPreventive.createdAt)}` : "Sem preventiva registrada"}
                                  </em>
                                  {lastPreventive?.name && <small className="preventive-plan-used">Plano: {lastPreventive.name}</small>}
                                  <small className="preventive-next-date">
                                    {daysSinceLastPreventive !== null ? `${daysSinceLastPreventive} dia(s) desde a última • ` : ""}
                                    {nextPreventiveLabel}
                                  </small>
                                  <AutomationIndicatorDots
                                    indicators={device.automationIndicators}
                                    compact
                                    maxVisible={4}
                                    interactive={false}
                                  />
                                  <span className="preventive-device-badges">
                                    {badges.map((badge) => (
                                      <span key={`${device.id}-${badge.label}`} className={`pill ${badge.tone}`}>{badge.label}</span>
                                    ))}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}

                    {!preventiveGroups.size && (
                      <p className="empty">Nenhuma máquina encontrada para os filtros atuais.</p>
                    )}
                  </div>
                </section>

                {selectedPreventiveAssets.size > 0 && (
                <aside className="preventive-plan-builder ready" aria-label="Criar plano preventivo">
                  <header>
                    <span className="preventive-step-pill">Etapa 2</span>
                    <h3>Selecionar verificações/scripts</h3>
                  </header>

                  <label>
                    Nome do plano
                    <input
                      value={preventivePlanName}
                      disabled={!canCreatePreventivePlans}
                      onChange={(event) => setPreventivePlanName(event.target.value)}
                    />
                  </label>

                  <section className="preventive-script-list">
                    <div>
                      <h4>Verificações selecionáveis</h4>
                      <p>{recommendedPreventiveScripts.length ? "Recomendações aparecem primeiro." : "Selecione máquinas para melhorar as recomendações."}</p>
                    </div>
                    {preventiveScriptRecommendations.loading && (
                      <p className="empty">Carregando recomendações...</p>
                    )}
                    {preventiveScriptRecommendations.error && (
                      <p className="empty">{preventiveScriptRecommendations.error}</p>
                    )}
                    {orderedPreventiveScripts.map((script) => {
                      const selected = selectedPreventiveScripts.has(script.id);
                      const expanded = expandedPreventiveScripts.has(script.id);
                      const scriptDetails =
                        script.description ||
                        script.estimatedSummary ||
                        script.recommendationReason ||
                        script.category ||
                        "Sem descrição cadastrada para este script.";
                      return (
                        <article
                          key={script.id}
                          className={`preventive-script-option ${selected ? "selected" : ""} ${expanded ? "expanded" : ""}`}
                        >
                          <button
                            type="button"
                            className="preventive-script-select"
                            disabled={!canCreatePreventivePlans}
                            onClick={() => togglePreventiveScript(script.id)}
                          >
                            <span className="preventive-device-check" aria-hidden="true">
                              {selected ? "✓" : ""}
                            </span>
                            <span>
                              <strong>{script.name}</strong>
                              <small>{script.recommendationReason || script.estimatedSummary || script.category || "Script cadastrado"}</small>
                            </span>
                            <em>{script.riskLevel || "médio"}</em>
                          </button>
                          <button
                            type="button"
                            className="icon-button preventive-script-expand"
                            onClick={() => togglePreventiveScriptDetails(script.id)}
                            aria-expanded={expanded}
                            aria-label={expanded ? "Recolher descrição do script" : "Expandir descrição do script"}
                            title={expanded ? "Recolher descrição" : "Ver descrição"}
                          >
                            <ChevronDown size={16} />
                          </button>
                          {expanded && (
                            <div className="preventive-script-details">
                              <strong>O que faz</strong>
                              <p>{scriptDetails}</p>
                            </div>
                          )}
                        </article>
                      );
                    })}
                    {!orderedPreventiveScripts.length && (
                      <p className="empty">Nenhuma verificação/script ativo cadastrado.</p>
                    )}
                  </section>

                  <div className="preventive-plan-summary-card">
                    <span>{selectedPreventiveAssets.size} máquina(s)</span>
                    <span>{selectedPreventiveScriptList.length} verificação(ões)</span>
                  </div>

                  <div className="preventive-plan-actions">
                    {canViewPreventiveAutomation && (
                      <button
                        type="button"
                        className="secondary-action compact-action"
                        disabled={
                          !canCreatePreventiveAutomation ||
                          !selectedPreventiveAssets.size ||
                          !selectedPreventiveScripts.size
                        }
                        onClick={openPreventiveAutomationFromSelection}
                      >
                        Automatizar
                      </button>
                    )}
                    <button
                      type="button"
                      className="primary-action compact-action"
                      disabled={
                        !canCreatePreventivePlans ||
                        preventiveSaving ||
                        !selectedPreventiveAssets.size ||
                        !selectedPreventiveScripts.size
                      }
                      onClick={openPreventiveReview}
                    >
                      {preventiveSaving ? "Registrando..." : "Revisar preventiva"}
                    </button>
                  </div>
                </aside>
                )}
              </div>

              {canViewPreventiveAutomation && (
                <PreventiveAutomationPanel
                  variant="embedded"
                  plans={preventiveAutomationPlans}
                  scripts={activeScripts}
                  devices={devices}
                  segments={segments}
                  segmentGroups={segmentGroups}
                  inventoryTabs={inventoryTabs}
                  canCreate={canCreatePreventiveAutomation}
                  canUpdate={canUpdatePreventiveAutomation}
                  canDisable={canDisablePreventiveAutomation}
                  createRequest={preventiveAutomationCreateRequest}
                  onSave={onSavePreventiveAutomationPlan}
                  onDisable={onDisablePreventiveAutomationPlan}
                  onCreateAutomatedPreventivePlan={createAutomatedPreventivePlanFromSelection}
                  onCreateRequestHandled={handlePreventiveAutomationCreateRequestHandled}
                />
              )}
            </section>
          )}

          {alertActiveTab === "automation" && canShowAutomationManagement && (
            <Suspense fallback={<ViewLoadingState />}>
              <AutomationManagementView
                management={preventiveAutomationManagement}
                devices={devices}
                segments={segments}
                segmentGroups={segmentGroups}
                inventoryTabs={inventoryTabs}
                scripts={scripts}
                loading={preventiveAutomationManagementLoading}
                error={preventiveAutomationManagementError}
                permissions={{
                  update: canUpdatePreventiveAutomation,
                  disable: canDisablePreventiveAutomation,
                  delete: canDeletePreventiveAutomation,
                  removeAsset: canRemovePreventiveAutomationAsset,
                  manageOverride: canManagePreventiveAutomationOverride
                }}
                onRetry={onRefreshPreventiveAutomationManagement}
                onSavePlan={onSavePreventiveAutomationPlan}
                onPausePlan={onDisablePreventiveAutomationPlan}
                onReactivatePlan={onReactivatePreventiveAutomationPlan}
                onDeletePlan={onDeletePreventiveAutomationPlan}
                onSaveOverride={onSavePreventiveAutomationAssetOverride}
                onRemoveOverride={onRemovePreventiveAutomationAssetOverride}
                onRemoveAsset={onRemoveAssetFromPreventiveAutomationPlan}
                onFetchAssetDetails={onFetchPreventiveAutomationAsset}
                onFetchAgenda={loadPreventiveAutomationAgenda}
                onFetchPlanHistory={loadPreventiveAutomationPlanHistory}
              />
            </Suspense>
          )}

          {preventiveReviewOpen && (
            <div className="modal-backdrop preventive-review-backdrop" role="presentation">
              <section
                className="modal-panel preventive-review-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="preventive-review-title"
              >
                <header>
                  <div>
                    <span>Revisão da preventiva</span>
                    <h2 id="preventive-review-title">Registrar plano preventivo</h2>
                    <p>
                      Confira o escopo antes de registrar. Esta tela não executa scripts nem envia comandos para
                      máquinas.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setPreventiveReviewOpen(false)}
                    aria-label="Fechar revisão"
                  >
                    <XCircle size={18} />
                  </button>
                </header>

                <div className="preventive-review-grid">
                  <section>
                    <h3>Plano</h3>
                    <dl>
                      <div>
                        <dt>Nome</dt>
                        <dd>{preventivePlanName || "Plano preventivo"}</dd>
                      </div>
                      <div>
                        <dt>Origem</dt>
                        <dd>Manual, pelo módulo de Avisos</dd>
                      </div>
                    </dl>
                  </section>

                  <section>
                    <h3>Máquinas selecionadas</h3>
                    <strong>{selectedPreventiveDevices.length} máquina(s)</strong>
                    <ul>
                      {selectedPreventiveDevices.slice(0, 6).map((device) => (
                        <li key={device.id}>{device.name || device.id}</li>
                      ))}
                      {selectedPreventiveDevices.length > 6 && (
                        <li>+ {selectedPreventiveDevices.length - 6} máquina(s)</li>
                      )}
                    </ul>
                  </section>

                  <section>
                    <h3>Verificações selecionadas</h3>
                    <strong>{selectedPreventiveScriptList.length} verificação(ões)</strong>
                    <ul>
                      {selectedPreventiveScriptList.map((script) => (
                        <li key={script.id}>
                          {script.name}
                          <span>{script.riskLevel || "médio"}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3>Riscos</h3>
                    {selectedPreventiveRiskList.length ? (
                      <ul>
                        {selectedPreventiveRiskList.map((script) => (
                          <li key={script.id}>{script.name} — {script.riskLevel}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Nenhuma verificação de alto risco selecionada.</p>
                    )}
                  </section>
                </div>

                <footer>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setPreventiveReviewOpen(false)}
                    disabled={preventiveSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={confirmPreventivePlanRegistration}
                    disabled={preventiveSaving}
                  >
                    {preventiveSaving ? "Registrando..." : "Registrar preventiva"}
                  </button>
                </footer>
              </section>
            </div>
          )}

          {alertActiveTab === "history" && (
            <section className="panel alerts-history-panel">
              <div className="panel-heading">
                <div>
                  <h2>Histórico de avisos</h2>
                  <p>Avisos resolvidos, sugestões aceitas e recusas registradas.</p>
                </div>
                <ClipboardList size={18} />
              </div>
              <div className="alert-board alert-history-board">
                {resolvedAlerts.map((alert) => {
                  const machineLabel = getAlertMachineLabel(alert);
                  return (
                    <article key={alert.id} className="alert-history-card">
                      <span className="pill ok">Resolvido</span>
                      <h3>{alert.title}</h3>
                      <p>{machineLabel} · {formatAlertValue(alert)}</p>
                      <small>{formatDate(alert.updatedAt || alert.resolvedAt || alert.startedAt)}</small>
                    </article>
                  );
                })}
                {handledSuggestions.map((suggestion, index) => (
                  <article key={suggestion.id} className="alert-history-card">
                    <span className={`pill ${suggestion.status === "accepted" ? "ok" : "danger"}`}>
                      {suggestionStatusLabels[suggestion.status] || suggestion.status}
                    </span>
                    <h3>{formatSuggestionCode(suggestion, index)} · {suggestion.title}</h3>
                    <p>{getSuggestionMachineLabel(suggestion)}</p>
                    <small>{suggestion.createdServiceOrderId ? `OS criada: ${suggestion.createdServiceOrderId}` : suggestion.rejectionReason || "Sem observação"}</small>
                  </article>
                ))}
                {!resolvedAlerts.length && !handledSuggestions.length && (
                  <p className="empty">Nenhum histórico encontrado ainda.</p>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {selectedSuggestionInfo && selectedSuggestionInfoModel && (
        <div
          className="modal-backdrop suggestion-info-backdrop"
          onMouseDown={() => setSelectedSuggestionInfoId(null)}
        >
          <section
            className="modal-panel suggestion-info-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suggestion-info-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="suggestion-info-header">
              <div>
                <span>{formatSuggestionCode(selectedSuggestionInfo, selectedSuggestionIndex)}</span>
                <h2 id="suggestion-info-title">{selectedSuggestionInfo.title}</h2>
                <p>
                  {selectedSuggestionInfoModel.machineLabel} - {selectedSuggestionInfoModel.location.groupName} - {selectedSuggestionInfoModel.location.segmentName}
                </p>
                <div className="suggestion-info-badges">
                  <span className={`pill ${selectedSuggestionInfo.status === "accepted" ? "ok" : selectedSuggestionInfo.status === "rejected" ? "danger" : "warning"}`}>
                    {suggestionStatusLabels[selectedSuggestionInfo.status] || selectedSuggestionInfo.status}
                  </span>
                  <span className={`pill ${selectedSuggestionInfoModel.priority === "critical" ? "danger" : "warning"}`}>
                    {selectedSuggestionInfoModel.priorityLabel}
                  </span>
                  <span className="pill">{selectedSuggestionInfo.category || getAlertCategory(selectedSuggestionInfoModel.alert)}</span>
                </div>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedSuggestionInfoId(null)}
                aria-label="Fechar detalhes do aviso"
                title="Fechar detalhes do aviso"
              >
                <XCircle size={18} />
              </button>
            </header>

            <div className="suggestion-info-body">
              <section className="suggestion-info-section">
                <h3>Informações da máquina</h3>
                <div className="suggestion-info-grid">
                  <div className="suggestion-info-item">
                    <span>Nome</span>
                    <strong>{selectedSuggestionInfoModel.machineLabel}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Tipo do ativo</span>
                    <strong>{selectedSuggestionInfoModel.device?.type || selectedSuggestionInfoModel.device?.manualAsset?.type || selectedSuggestionInfo.category || "Não informado"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>IP</span>
                    <strong>{selectedSuggestionInfoModel.device?.ip || selectedSuggestionInfoModel.device?.manualAsset?.ip || "Não informado"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Sistema operacional</span>
                    <strong>{selectedSuggestionInfoModel.device?.os || selectedSuggestionInfoModel.device?.manualAsset?.os || "Não informado"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Aba/Ambiente</span>
                    <strong>{selectedSuggestionInfoModel.device?.tabName || selectedSuggestionInfoModel.device?.environment || "Não informado"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Grupo</span>
                    <strong>{selectedSuggestionInfoModel.location.groupName}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Segmento</span>
                    <strong>{selectedSuggestionInfoModel.location.segmentName}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Backup</span>
                    <strong>{selectedSuggestionInfoModel.device?.isBackup ? "Sim" : "Não"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Em manutenção</span>
                    <strong>{selectedSuggestionInfoModel.device?.maintenanceActive || selectedSuggestionInfoModel.device?.maintenanceStatus === "active" ? "Sim" : "Não"}</strong>
                  </div>
                </div>
              </section>

              <section className="suggestion-info-section">
                <h3>Informações do aviso</h3>
                <div className="suggestion-info-grid">
                  <div className="suggestion-info-item">
                    <span>Tipo</span>
                    <strong>{alertTypeLabels[selectedSuggestionInfoModel.alert.type] || selectedSuggestionInfoModel.alert.type || "Aviso preventivo"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Categoria</span>
                    <strong>{selectedSuggestionInfo.category || getAlertCategory(selectedSuggestionInfoModel.alert)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Métrica</span>
                    <strong>{selectedSuggestionInfoModel.alert.metric || "Não informada"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Valor atual</span>
                    <strong>{formatAlertValue(selectedSuggestionInfoModel.alert)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Limite</span>
                    <strong>{formatAlertThreshold(selectedSuggestionInfoModel.alert)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Ocorrências</span>
                    <strong>{selectedSuggestionInfoModel.alert.occurrencesCount || 1}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Primeira ocorrência</span>
                    <strong>{formatDate(selectedSuggestionInfoModel.alert.firstSeenAt)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Última ocorrência</span>
                    <strong>{formatDate(selectedSuggestionInfoModel.alert.lastSeenAt)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Confiança</span>
                    <strong>{selectedSuggestionInfo.confidenceLevel || getAlertConfidence(selectedSuggestionInfoModel.alert)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Tendência</span>
                    <strong>{selectedSuggestionInfo.trend || getAlertTrend(selectedSuggestionInfoModel.alert)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Score/Risco</span>
                    <strong>{Math.round(selectedSuggestionInfo.recurrenceScore || 0) || "N/D"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Origem</span>
                    <strong>Sistema</strong>
                  </div>
                </div>
              </section>

              <section className="suggestion-info-section">
                <h3>Explicações técnicas</h3>
                <div className="suggestion-info-text-list">
                  <p><strong>Motivo da prioridade:</strong> {selectedSuggestionInfo.priorityReason || "Prioridade definida pela regra atual do aviso."}</p>
                  <p><strong>Impacto operacional:</strong> {selectedSuggestionInfo.operationalImpact || getAlertImpact(selectedSuggestionInfoModel.alert)}</p>
                  <p><strong>Causa provável:</strong> {selectedSuggestionInfo.probableCause || getAlertProbableCause(selectedSuggestionInfoModel.alert)}</p>
                  <p><strong>Ação recomendada:</strong> {selectedSuggestionInfo.recommendedAction || getAlertRecommendedAction(selectedSuggestionInfoModel.alert)}</p>
                  {selectedSuggestionInfo.recurrenceInsight?.summary && (
                    <p><strong>Reincidência:</strong> {selectedSuggestionInfo.recurrenceInsight.summary}</p>
                  )}
                  {selectedSuggestionInfo.falsePositiveInsight?.summary && (
                    <p><strong>Possível falso positivo:</strong> {selectedSuggestionInfo.falsePositiveInsight.summary}</p>
                  )}
                  {selectedSuggestionInfo.capacityForecast?.summary && (
                    <p><strong>Capacidade/previsão:</strong> {selectedSuggestionInfo.capacityForecast.summary}</p>
                  )}
                </div>
              </section>

              <section className="suggestion-info-section">
                <h3>Checklist sugerido</h3>
                {selectedSuggestionInfoModel.checklist.length > 0 ? (
                  <ul className="suggestion-info-checklist">
                    {selectedSuggestionInfoModel.checklist.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="suggestion-info-empty">Nenhum item de checklist cadastrado para este aviso.</p>
                )}
              </section>

              <section className="suggestion-info-section">
                <h3>Correlação</h3>
                {selectedSuggestionInfoModel.correlations.length > 0 ? (
                  <div className="suggestion-info-correlations">
                    {selectedSuggestionInfoModel.correlations.map((correlation) => (
                      <article key={correlation.correlationId || correlation.id}>
                        <span>{correlation.confidenceLevel || "Média"} confiança</span>
                        <strong>{correlation.correlationSummary || "Aviso correlacionado"}</strong>
                        <small>{(correlation.relatedHosts || []).join(", ") || "Sem máquinas relacionadas"}</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="suggestion-info-empty">Nenhuma correlação encontrada para esta sugestão.</p>
                )}
              </section>

              <section className="suggestion-info-section">
                <h3>Comentários internos</h3>
                <div className="alert-comments suggestion-info-comments">
                  {selectedSuggestionInfoModel.comments.map((comment) => (
                    <p key={comment.id}>
                      <span>{comment.userName || "Usuário"} - {formatDate(comment.createdAt)}</span>
                      {comment.message}
                    </p>
                  ))}
                  {!selectedSuggestionInfoModel.comments.length && <small>Nenhum comentário registrado.</small>}
                  {canCommentAlerts && selectedSuggestionInfo.alertId && (
                    <div className="alert-comment-form">
                      <input
                        value={commentDrafts[selectedSuggestionInfo.alertId] || ""}
                        onChange={(event) => setCommentDrafts((current) => ({ ...current, [selectedSuggestionInfo.alertId]: event.target.value }))}
                        placeholder="Adicionar comentário interno"
                      />
                      <button type="button" className="secondary-action compact-action" onClick={() => submitAlertComment(selectedSuggestionInfo.alertId)}>
                        Comentar
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <footer className="suggestion-info-footer">
              {canManageSuggestions && selectedSuggestionInfo.status === "pending" && (
                <>
                  <button
                    type="button"
                    className="primary-action compact-action"
                    onClick={async () => {
                      await onAcceptSuggestion(selectedSuggestionInfo.id);
                      setSelectedSuggestionInfoId(null);
                    }}
                  >
                    Criar OS
                  </button>
                  <button
                    type="button"
                    className="danger-action compact-action"
                    onClick={async () => {
                      await onRejectSuggestion(selectedSuggestionInfo.id);
                      setSelectedSuggestionInfoId(null);
                    }}
                  >
                    Recusar
                  </button>
                </>
              )}
              <button type="button" className="secondary-action compact-action" onClick={() => setSelectedSuggestionInfoId(null)}>
                Fechar
              </button>
            </footer>
          </section>
        </div>
      )}

      {selectedScriptLog && (
        <div className="modal-backdrop suggestion-info-backdrop" onMouseDown={() => setSelectedScriptLog(null)}>
          <section className="modal-panel script-log-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>LOG DE SCRIPT</span>
                <h2>{selectedScriptLog.scriptName || "Registro de script"}</h2>
                <p>{selectedScriptLog.parsedSummary || "Registro preparado para observação segura."}</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setSelectedScriptLog(null)} aria-label="Fechar log">
                <XCircle size={18} />
              </button>
            </header>
            <div className="script-log-body">
              <section className="script-log-summary">
                <div>
                  <span>Status</span>
                  <strong>{scriptValidationLabels[selectedScriptLog.validationStatus] || selectedScriptLog.status || "Registrado"}</strong>
                </div>
                <div>
                  <span>Erro detectado</span>
                  <strong>{selectedScriptLog.errorDetected ? "Sim" : "Não"}</strong>
                </div>
                <div>
                  <span>Tipo de erro</span>
                  <strong>{selectedScriptLog.errorType || "Não informado"}</strong>
                </div>
                <div>
                  <span>Categoria</span>
                  <strong>{selectedScriptLog.errorCategory || "Não informada"}</strong>
                </div>
                <div>
                  <span>Severidade</span>
                  <strong>{selectedScriptLog.errorSeverity || "Não informada"}</strong>
                </div>
                <div>
                  <span>Reconhecido</span>
                  <strong>{selectedScriptLog.acknowledgedAt ? formatDate(selectedScriptLog.acknowledgedAt) : "Pendente"}</strong>
                </div>
              </section>
              <section>
                <h3>Causa provavel</h3>
                <p>{selectedScriptLog.probableCause || "Nenhuma causa específica foi identificada."}</p>
              </section>
              <section>
                <h3>Solução sugerida</h3>
                <p>{selectedScriptLog.suggestedSolution || "Revise o script, o acesso ao ativo e as permissões antes de qualquer execução futura."}</p>
              </section>
              <section>
                <details className="script-log-details">
                  <summary>Log técnico</summary>
                  <pre className="script-log-raw">{selectedScriptLog.rawLog || "Nenhum log de script disponível."}</pre>
                </details>
              </section>
              {canResolveScriptLogs && !selectedScriptLog.previewOnly && (
                <label className="script-log-custom-solution">
                  Solução própria
                  <textarea
                    value={scriptLogCustomNotes}
                    onChange={(event) => setScriptLogCustomNotes(event.target.value)}
                    placeholder="Descreva a correção que será registrada sem executar comandos."
                  />
                </label>
              )}
            </div>
            <footer className="script-log-actions">
              {canResolveScriptLogs && !selectedScriptLog.previewOnly && (
                <>
                  <button
                    type="button"
                    className="primary-action compact-action"
                    onClick={async () => {
                      const confirmed = window.confirm(
                        "Esta acao nao executara comandos automaticamente nesta versao. Ela registrara uma acao corretiva sugerida para acompanhamento."
                      );
                      if (!confirmed) return;
                      await onApplyScriptLogSuggestedSolution(selectedScriptLog.id, {
                        notes: selectedScriptLog.suggestedSolution || "Solucao sugerida registrada para acompanhamento."
                      });
                      setSelectedScriptLog(null);
                      setScriptLogCustomNotes("");
                    }}
                  >
                    Registrar solução sugerida
                  </button>
                  <button
                    type="button"
                    className="secondary-action compact-action"
                    onClick={async () => {
                      const notes = scriptLogCustomNotes.trim() || "Solucao propria registrada pelo tecnico.";
                      await onApplyScriptLogSuggestedSolution(selectedScriptLog.id, { notes });
                      setSelectedScriptLog(null);
                      setScriptLogCustomNotes("");
                    }}
                  >
                    Registrar solução própria
                  </button>
                  <button
                    type="button"
                    className="secondary-action compact-action"
                    onClick={async () => {
                      await onAcknowledgeScriptLog(selectedScriptLog.id);
                      setSelectedScriptLog(null);
                      setScriptLogCustomNotes("");
                    }}
                  >
                    Marcar como analisado
                  </button>
                  <button
                    type="button"
                    className="danger-action compact-action"
                    onClick={async () => {
                      if (selectedScriptLog.validationId && onCancelScriptValidation) {
                        await onCancelScriptValidation(selectedScriptLog.validationId);
                      } else {
                        await onAcknowledgeScriptLog(selectedScriptLog.id);
                      }
                      setSelectedScriptLog(null);
                      setScriptLogCustomNotes("");
                    }}
                  >
                    Cancelar análise
                  </button>
                </>
              )}
              <button type="button" className="secondary-action compact-action" onClick={() => setSelectedScriptLog(null)}>
                Fechar
              </button>
            </footer>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop alert-settings-backdrop" onMouseDown={() => setSettingsOpen(false)}>
          <section className="modal-panel alert-settings-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header className="alert-settings-modal-header">
              <div>
                <span>AVISOS</span>
                <h2>Configurações de aviso</h2>
                <p>Regras de recorrência, limites e cadastro seguro de scripts de manutenção.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setSettingsOpen(false)}>
                <XCircle size={18} />
              </button>
            </header>

            {canViewAlerts && (
              <section className={`alert-settings-accordion ${settingsSectionsOpen.rules ? "open" : ""}`}>
                <button
                  type="button"
                  className="alert-settings-accordion-trigger"
                  onClick={() => toggleAlertSettingsSection("rules")}
                >
                  <div>
                    <h2>Regras de aviso</h2>
                    <p>Limites usados para sugerir Ordens de Serviço.</p>
                  </div>
                  <ChevronDown size={18} />
                </button>
                {settingsSectionsOpen.rules && (
                  <section className="panel alert-settings-section">
                    <div className="alert-settings-control-grid">
                      <label>
                        Ignorar aviso recusado por (horas)
                        <span className="input-with-unit">
                          <input
                            type="number"
                            min="1"
                            value={priorityDraft.rejectedAlertSilenceHours}
                            disabled={!canConfigureAlerts}
                            onChange={(event) => updateAlertOperationalDraft("rejectedAlertSilenceHours", event.target.value)}
                          />
                          <em>H</em>
                        </span>
                      </label>
                      <label>
                        Resetar recorrência a cada (horas)
                        <span className="input-with-unit">
                          <input
                            type="number"
                            min="1"
                            value={priorityDraft.recurrenceCounterResetHours}
                            disabled={!canConfigureAlerts}
                            onChange={(event) => updateAlertOperationalDraft("recurrenceCounterResetHours", event.target.value)}
                          />
                          <em>H</em>
                        </span>
                      </label>
                      <label>
                        Preventiva vence em (dias)
                        <span className="input-with-unit">
                          <input
                            type="number"
                            min="1"
                            value={priorityDraft.preventiveDueDays}
                            disabled={!canConfigureAlerts}
                            onChange={(event) => updateAlertOperationalDraft("preventiveDueDays", event.target.value)}
                          />
                          <em>D</em>
                        </span>
                      </label>
                      <label>
                        Validacao de script (minutos)
                        <span className="input-with-unit">
                          <input
                            type="number"
                            min="5"
                            max="10080"
                            value={priorityDraft.scriptValidationWindowMinutes}
                            disabled={!canConfigureAlerts}
                            onChange={(event) => updateAlertOperationalDraft("scriptValidationWindowMinutes", event.target.value)}
                          />
                          <em>M</em>
                        </span>
                      </label>
                      <button
                        type="button"
                        className="secondary-action compact-action"
                        disabled={!canConfigureAlerts || prioritySaving}
                        onClick={savePriorityDraft}
                      >
                        {prioritySaving ? "Salvando..." : "Salvar janelas"}
                      </button>
                    </div>
                <div className="settings-table alert-rules-table">
                  <div className="settings-table-head">
                    <span>Tipo</span>
                    <span>Limite</span>
                    <span>Tempo mínimo</span>
                    <span>Recorrência</span>
                    <span>Janela</span>
                    <span>Prioridade da OS</span>
                    <span>Status</span>
                  </div>
                  {rules.map((rule) => (
                    <div key={rule.id} className="settings-table-row alert-rule-row">
                      <span>{alertTypeLabels[rule.type] || rule.type}</span>
                      <span>
                        <label className={`input-with-unit ${isThresholdDisabled(rule) ? "disabled" : ""}`}>
                          <input
                            type="number"
                            min="0"
                            value={isThresholdDisabled(rule) ? "" : rule.threshold ?? ""}
                            disabled={!canConfigureAlerts || isThresholdDisabled(rule)}
                            onChange={(event) => onUpdateRule(rule.id, { threshold: event.target.value })}
                          />
                          {isPercentThresholdRule(rule) && !isThresholdDisabled(rule) && <em>%</em>}
                        </label>
                      </span>
                      <span>
                        <label className={`input-with-unit ${isDurationDisabled(rule) ? "disabled" : ""}`}>
                          <input
                            type="number"
                            min="0"
                            value={isDurationDisabled(rule) ? "" : rule.durationMinutes}
                            disabled={!canConfigureAlerts || isDurationDisabled(rule)}
                            onChange={(event) => onUpdateRule(rule.id, { durationMinutes: event.target.value })}
                          />
                          {!isDurationDisabled(rule) && <em>M</em>}
                        </label>
                      </span>
                      <span>
                        <label className="input-with-unit">
                          <input
                            type="number"
                            min="1"
                            value={rule.recurrenceCount}
                            disabled={!canConfigureAlerts}
                            onChange={(event) => onUpdateRule(rule.id, { recurrenceCount: event.target.value })}
                          />
                          <em>x</em>
                        </label>
                      </span>
                      <span>
                        <select
                          value={rule.recurrenceWindow}
                          disabled={!canConfigureAlerts}
                          onChange={(event) => onUpdateRule(rule.id, { recurrenceWindow: event.target.value })}
                        >
                          <option value="same_day">Mesmo dia</option>
                          <option value="last_24h">Últimas 24 horas</option>
                          <option value="custom">Período configurável</option>
                        </select>
                      </span>
                      <span>
                        <select
                          value={rule.suggestedPriority || "medium"}
                          disabled={!canConfigureAlerts}
                          onChange={(event) => onUpdateRule(rule.id, { suggestedPriority: event.target.value })}
                        >
                          {Object.entries(priorityLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </span>
                      <span>
                        <label className="inline-check">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            disabled={!canConfigureAlerts}
                            onChange={(event) => onUpdateRule(rule.id, { enabled: event.target.checked })}
                          />
                          Ativa
                        </label>
                      </span>
                    </div>
                  ))}
                </div>
                  </section>
                )}
              </section>
            )}

            {canViewAlerts && (
              <section className={`alert-settings-accordion ${settingsSectionsOpen.priority ? "open" : ""}`}>
                <button
                  type="button"
                  className="alert-settings-accordion-trigger"
                  onClick={() => toggleAlertSettingsSection("priority")}
                >
                  <div>
                    <h2>Prioridade</h2>
                    <p>Cores e tempos usados pelas prioridades das Ordens de Serviço.</p>
                  </div>
                  <ChevronDown size={18} />
                </button>
                {settingsSectionsOpen.priority && (
                  <section className="panel alert-settings-section">
                    <div className="service-order-number-settings alert-priority-settings">
                      <label>
                        Baixa para Média (horas)
                        <input
                          type="number"
                          min="1"
                          value={priorityDraft.autoPriority.lowToMediumHours}
                          disabled={!canConfigureAlertPrioritySettings}
                          onChange={(event) => updatePriorityDraft("autoPriority", "lowToMediumHours", event.target.value)}
                        />
                      </label>
                      <label>
                        Média para Alta (horas)
                        <input
                          type="number"
                          min="1"
                          value={priorityDraft.autoPriority.mediumToHighHours}
                          disabled={!canConfigureAlertPrioritySettings}
                          onChange={(event) => updatePriorityDraft("autoPriority", "mediumToHighHours", event.target.value)}
                        />
                      </label>
                      <label>
                        Alta para Crítica (horas)
                        <input
                          type="number"
                          min="1"
                          value={priorityDraft.autoPriority.highToCriticalHours}
                          disabled={!canConfigureAlertPrioritySettings}
                          onChange={(event) => updatePriorityDraft("autoPriority", "highToCriticalHours", event.target.value)}
                        />
                      </label>
                      <label className="settings-inline-check service-order-priority-enabled">
                        <input
                          type="checkbox"
                          checked={Boolean(priorityDraft.autoPriority.enabled)}
                          disabled={!canConfigureAlertPrioritySettings}
                          onChange={(event) => updatePriorityDraft("autoPriority", "enabled", event.target.checked)}
                        />
                        Ativar mudança automática de prioridade
                      </label>
                      <button
                        type="button"
                        className="secondary-action compact-action alert-priority-color-toggle"
                        disabled={!canConfigureAlertPrioritySettings}
                        onClick={() => setPriorityColorsOpen((current) => !current)}
                      >
                        <Palette size={15} />
                        {priorityColorsOpen ? "Ocultar cores" : "Cores"}
                      </button>
                      {priorityColorsOpen && (
                        <div className="service-order-priority-colors service-order-priority-colors-expanded">
                          {Object.entries(priorityLabels).map(([priority, label]) => (
                            <label key={priority}>
                              <span className="service-order-color-swatch" style={{ background: priorityDraft.priorityColors[priority] }} />
                              {label}
                              <input
                                type="color"
                                value={priorityDraft.priorityColors[priority]}
                                disabled={!canConfigureAlertPrioritySettings}
                                onChange={(event) => changePriorityDraftColor(priority, event.target.value)}
                                aria-label={`Cor da prioridade ${label}`}
                              />
                            </label>
                          ))}
                          <button
                            type="button"
                            className="ghost-action compact-action"
                            disabled={!canConfigureAlertPrioritySettings}
                            onClick={() => setPriorityDraft((current) => ({ ...current, priorityColors: defaultPriorityColors }))}
                          >
                            <RotateCcw size={15} />
                            Padrão
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        className="primary-action compact-action alert-priority-save"
                        disabled={!canConfigureAlertPrioritySettings || prioritySaving}
                        onClick={savePriorityDraft}
                      >
                        <Palette size={15} />
                        {prioritySaving ? "Salvando..." : "Salvar prioridade"}
                      </button>
                    </div>
                  </section>
                )}
              </section>
            )}

            {canViewScripts && (
              <section className={`alert-settings-accordion ${settingsSectionsOpen.scripts ? "open" : ""}`}>
                <button
                  type="button"
                  className="alert-settings-accordion-trigger"
                  onClick={() => toggleAlertSettingsSection("scripts")}
                >
                  <div>
                    <h2>Scripts de manutenção</h2>
                    <p>Cadastro seguro, análise textual e scripts disponíveis nos cards.</p>
                  </div>
                  <ChevronDown size={18} />
                </button>
                {settingsSectionsOpen.scripts && (
                  <div className="alert-settings-accordion-body">
                    <MaintenanceScriptsPanel
                      scripts={scripts}
                      devices={devices}
                      serviceOrders={serviceOrders}
                      alerts={alerts}
                      canManage={canManageScripts}
                      canRegisterSimulation={canRegisterScriptSimulation}
                      showHeader={false}
                      showSafetyBanner={false}
                      showSimulation={false}
                      onAnalyze={onAnalyzeMaintenanceScript}
                      onSave={onSaveMaintenanceScript}
                      onDeactivate={onDeactivateMaintenanceScript}
                      onRegisterSimulation={onRegisterMaintenanceScriptSimulation}
                    />
                  </div>
                )}
              </section>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
