import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core";
import {
  Activity,
  AlertTriangle,
  Database,
  LogOut,
  Moon,
  Network,
  PanelLeftClose,
  ClipboardList,
  RefreshCw,
  Search,
  Server,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  WifiOff,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  acceptServiceOrderSuggestion,
  acknowledgeScriptLog,
  analyzeMaintenanceScript,
  applyScriptLogSuggestedSolution,
  cancelScriptValidation,
  createAlertComment,
  createMaintenanceScript,
  createManualAsset,
  createPreventivePlan,
  createPreventivePlanServiceOrder,
  createPreventiveAutomationPlan,
  createSegment,
  createSegmentGroup as createSegmentGroupApi,
  deleteDevice,
  deleteMaintenanceScript,
  deletePreventiveAutomationPlan,
  disablePreventiveAutomationPlan,
  deleteServiceOrder,
  deleteSegment,
  deleteSegmentGroup as deleteSegmentGroupApi,
  evaluateAlerts,
  fetchAlertCorrelations,
  fetchDevice,
  fetchPreventiveAutomationAsset,
  fetchUserPreference,
  removeAssetFromPreventiveAutomationPlan,
  removePreventiveAutomationAssetOverride,
  rejectServiceOrderSuggestion,
  renameSegment,
  registerMaintenanceScriptSimulation,
  refreshAssetPing,
  createServiceOrder,
  addServiceOrderHistory,
  updateServiceOrder,
  updateAlertSettings,
  updateServiceOrderStatus,
  updateDeviceBackup,
  updateSegmentGroup,
  updateDeviceType,
  updateDeviceSegment,
  updateAlertRule,
  updateMaintenanceScript,
  updatePreventiveAutomationPlan,
  savePreventiveAutomationAssetOverride,
  saveUserPreference,
  updateSystemSettings,
  useSuggestionScript as executeSuggestionScript
} from "./api.js";
import { normalizePrioritySettings } from "./components/alerts/alertUtils.js";
import AlertCenterV2 from "./components/alerts/AlertCenterV2.jsx";
import AssetPublicView from "./components/inventory/AssetPublicView.jsx";
import AssetDragCompactOverlay from "./components/inventory/AssetDragCompactOverlay.jsx";
import BulkAssetLabelPrint from "./components/inventory/BulkAssetLabelPrint.jsx";
import InventoryTabFormModal from "./components/inventory/InventoryTabFormModal.jsx";
import ManualAssetForm from "./components/inventory/ManualAssetForm.jsx";
import SegmentDragOverlay from "./components/inventory/SegmentDragOverlay.jsx";
import SegmentFormModal from "./components/inventory/SegmentFormModal.jsx";
import SegmentGroupFormModal from "./components/inventory/SegmentGroupFormModal.jsx";
import SidebarSegmentFilter from "./components/inventory/SidebarSegmentFilter.jsx";
import { useInventoryDragAndDrop } from "./components/inventory/useInventoryDragAndDrop.js";
import GeneralSettingsModal from "./components/settings/GeneralSettingsModal.jsx";
import PublicSupportRequest from "./components/public/PublicSupportRequest.jsx";
import { hasPermission } from "./permissions.js";
import {
  assignSegmentToGroup,
  getSegmentGroupId,
  hasDuplicateSegmentName,
  moveIdInList,
  upsertSegmentList
} from "./components/inventory/inventoryUtils.js";
import {
  activeInventoryTabKey,
  aliasKey,
  applyInventoryLocalState,
  applySegmentGroups,
  backupSegmentId,
  backupSegmentName,
  defaultInventoryTab,
  getNextInventoryTabName,
  inventoryTabMetaKey,
  inventoryTabsKey,
  isReservedSegmentName,
  maintenanceRecordsKey,
  normalizeInventoryTabMeta,
  normalizeInventoryTabs,
  observationsKey,
  peripheralHistoryKey,
  peripheralKey,
  peripheralRemovalsKey,
  pickSegmentColor,
  pickUnusedPaletteColor,
  readStoredJson
} from "./components/inventory/inventoryLocalState.js";
import ViewLoadingState from "./components/ui/ViewLoadingState.jsx";
import SummaryCard from "./components/ui/SummaryCard.jsx";
import Toast from "./components/ui/Toast.jsx";
import PermissionBlocked from "./components/ui/PermissionBlocked.jsx";
import AuthScreen from "./components/auth/AuthScreen.jsx";
import AlertList from "./components/dashboard/AlertList.jsx";
import DeviceDetails from "./components/dashboard/DeviceDetails.jsx";
import DeviceTable from "./components/dashboard/DeviceTable.jsx";
import { isMaintenanceSegmentName } from "./utils/display.js";
import { useAppSessionController } from "./hooks/useAppSessionController.js";
import { useDashboardData } from "./hooks/useDashboardData.js";

const InventoryBoard = lazy(() => import("./components/inventory/InventoryBoard.jsx"));
const ServiceOrdersBoard = lazy(() => import("./components/serviceOrders/ServiceOrdersBoard.jsx"));

function readSystemMode() {
  return "local";
}

const inventoryDropAnimation = {
  duration: 210,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)"
};

function keepDragOverlayNearCursor({ activatorEvent, active, activeNodeRect, overlayNodeRect, transform }) {
  const dragType = active?.data?.current?.type;

  if (
    (dragType !== "machine" && dragType !== "segment") ||
    !activatorEvent ||
    !activeNodeRect ||
    !overlayNodeRect
  ) {
    return transform;
  }

  const point = "touches" in activatorEvent
    ? activatorEvent.touches?.[0]
    : activatorEvent;

  if (!point || typeof point.clientX !== "number" || typeof point.clientY !== "number") {
    return transform;
  }

  const initialOffsetX = point.clientX - activeNodeRect.left;
  const initialOffsetY = point.clientY - activeNodeRect.top;
  const cursorGapX = dragType === "segment"
    ? 14
    : Math.min(18, Math.max(12, overlayNodeRect.width * 0.06));
  const desiredOffsetY = dragType === "segment"
    ? Math.min(18, Math.max(10, overlayNodeRect.height * 0.4))
    : Math.min(24, Math.max(14, overlayNodeRect.height * 0.18));

  return {
    ...transform,
    x: transform.x + initialOffsetX + cursorGapX,
    y: transform.y + initialOffsetY - desiredOffsetY
  };
}

function inventoryCollisionDetection(args) {
  const { active, pointerCoordinates, droppableContainers, droppableRects } = args;
  const activeType = active?.data?.current?.type;

  if (activeType === "segment") {
    const groupContainers = droppableContainers.filter(
      (container) =>
        container.data.current?.type === "segment-group-drop" ||
        container.data.current?.type === "sidebar-segment-group-drop"
    );
    return closestCenter({ ...args, droppableContainers: groupContainers });
  }

  const pointerNearSidebar = !pointerCoordinates || pointerCoordinates.x <= 400;
  const segmentContainers = droppableContainers.filter(
    (container) => container.data.current?.type === "segment"
  );
  const sidebarSegmentContainers = pointerNearSidebar
    ? droppableContainers.filter((container) => container.data.current?.type === "sidebar-segment")
    : [];
  const machineContainers = [...segmentContainers, ...sidebarSegmentContainers];

  if (pointerCoordinates) {
    const sidebarCandidates = sidebarSegmentContainers
      .map((container) => {
        const rect = droppableRects.get(container.id);
        if (!rect) return null;

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = Math.max(rect.left - pointerCoordinates.x, 0, pointerCoordinates.x - rect.right);
        const dy = Math.max(rect.top - pointerCoordinates.y, 0, pointerCoordinates.y - rect.bottom);
        const edgeDistance = Math.hypot(dx, dy);
        const centerDistance = Math.hypot(pointerCoordinates.x - centerX, pointerCoordinates.y - centerY);
        const insideMagneticZone =
          pointerCoordinates.x >= rect.left - 84 &&
          pointerCoordinates.x <= rect.right + 132 &&
          pointerCoordinates.y >= rect.top - 34 &&
          pointerCoordinates.y <= rect.bottom + 34;

        return insideMagneticZone
          ? {
              id: container.id,
              data: {
                droppableContainer: container,
                value: edgeDistance * 0.72 + centerDistance * 0.28
              }
            }
          : null;
      })
      .filter(Boolean)
      .sort((left, right) => left.data.value - right.data.value);

    if (sidebarCandidates.length) {
      return [sidebarCandidates[0]];
    }

    const segmentCandidates = segmentContainers
      .map((container) => {
        const rect = droppableRects.get(container.id);
        if (!rect) return null;
        const inside =
          pointerCoordinates.x >= rect.left &&
          pointerCoordinates.x <= rect.right &&
          pointerCoordinates.y >= rect.top &&
          pointerCoordinates.y <= rect.bottom;
        if (!inside) return null;

        return {
          id: container.id,
          data: {
            droppableContainer: container,
            value: rect.width * rect.height
          }
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.data.value - right.data.value);

    if (segmentCandidates.length) {
      return [segmentCandidates[0]];
    }
  }

  return closestCenter({ ...args, droppableContainers: machineContainers });
}

function metricClass(value) {
  if (value >= 85) return "danger";
  if (value >= 70) return "warning";
  return "ok";
}

function statusClass(status) {
  return {
    online: "ok",
    offline: "danger",
    problem: "warning"
  }[status];
}

function formatTime(value) {
  if (!value) return "--:--";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function Dashboard({ token, user, theme, onToggleTheme, onLogout, notify }) {
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [alertStatusFilter, setAlertStatusFilter] = useState("all");
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState("all");
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedInventoryGroup, setSelectedInventoryGroup] = useState("all");
  const [selectedInventorySegment, setSelectedInventorySegment] = useState("all");
  const [machineAliases, setMachineAliases] = useState(() =>
    JSON.parse(localStorage.getItem(aliasKey) || "{}")
  );
  const [machineObservations, setMachineObservations] = useState(() =>
    JSON.parse(localStorage.getItem(observationsKey) || "{}")
  );
  const [removedPeripherals, setRemovedPeripherals] = useState(() =>
    JSON.parse(localStorage.getItem(peripheralRemovalsKey) || "{}")
  );
  const [peripheralHistory, setPeripheralHistory] = useState(() =>
    JSON.parse(localStorage.getItem(peripheralHistoryKey) || "{}")
  );
  const [maintenanceRecords, setMaintenanceRecords] = useState(() =>
    readStoredJson(maintenanceRecordsKey, {})
  );
  const [inventoryTabs, setInventoryTabs] = useState(() =>
    normalizeInventoryTabs(readStoredJson(inventoryTabsKey, [defaultInventoryTab]))
  );
  const [activeInventoryTabId, setActiveInventoryTabId] = useState(() =>
    localStorage.getItem(activeInventoryTabKey) || defaultInventoryTab.id
  );
  const [inventoryTabMeta, setInventoryTabMeta] = useState(() =>
    normalizeInventoryTabMeta(readStoredJson(inventoryTabMetaKey, {}))
  );
  const [moveModal, setMoveModal] = useState(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [segmentForm, setSegmentForm] = useState(null);
  const [segmentGroupForm, setSegmentGroupForm] = useState(null);
  const [inventoryTabForm, setInventoryTabForm] = useState(null);
  const [manualAssetFormOpen, setManualAssetFormOpen] = useState(false);
  const [manualAssetSaving, setManualAssetSaving] = useState(false);
  const [segmentGroupSaving, setSegmentGroupSaving] = useState(false);
  const [activeDragMachine, setActiveDragMachine] = useState(null);
  const [activeDragSegment, setActiveDragSegment] = useState(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState(() => new Set());
  const [bulkMoveTarget, setBulkMoveTarget] = useState("");
  const [bulkPrintAssets, setBulkPrintAssets] = useState([]);
  const bulkPrintCleanupTimer = useRef(null);
  const bulkPrintAfterprintHandler = useRef(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarHoverOpen, setSidebarHoverOpen] = useState(false);
  const [sidebarDragActive, setSidebarDragActive] = useState(false);
  const [segmentSaving, setSegmentSaving] = useState(false);
  const [serviceOrderSaving, setServiceOrderSaving] = useState(false);
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);
  const canViewDashboard = hasPermission(user, "dashboard.view");
  const canViewAlerts = hasPermission(user, "alerts.view");
  const canViewScripts = hasPermission(user, "scripts.view");
  const canViewPreventivePlans = hasPermission(user, "preventive_plans.view");
  const canViewPreventiveAutomation = hasPermission(user, "preventive_automation.view");
  const canViewInventory = hasPermission(user, "inventory.view");
  const canViewMachine = hasPermission(user, "inventory.view_machine");
  const canViewServiceOrders = hasPermission(user, "service_orders.view");
  const {
    alertCorrelations,
    alertPriorityColors,
    alertPrioritySettings,
    alertRules,
    alerts,
    allDevices,
    devices,
    history,
    lastUpdated,
    loading,
    loadData,
    maintenanceScripts,
    preventiveAutomationManagement,
    preventiveAutomationManagementError,
    preventiveAutomationPlans,
    preventivePlans,
    segmentGroups,
    segments,
    serviceOrderSuggestions,
    serviceOrders,
    setAlertCorrelations,
    setAlertPriorityColors,
    setAlertPrioritySettings,
    setAlertRules,
    setAlerts,
    setAllDevices,
    setDevices,
    setMaintenanceScripts,
    setPreventiveAutomationPlans,
    setPreventivePlans,
    setSegmentGroups,
    setSegments,
    setServiceOrderSuggestions,
    setServiceOrders,
    setSystemMode,
    summary,
    systemMode
  } = useDashboardData({
    activeView,
    applyInventoryLocalState,
    applySegmentGroups,
    canViewAlerts,
    canViewInventory,
    canViewMachine,
    canViewPreventiveAutomation,
    canViewPreventivePlans,
    canViewScripts,
    canViewServiceOrders,
    initialSystemMode: readSystemMode,
    logout: onLogout,
    maintenanceRecords,
    notify,
    onMaintenanceRecordsChange: saveMaintenanceRecords,
    peripheralHistory,
    removedPeripherals,
    search,
    selectedId,
    setSelectedDevice,
    setSelectedId,
    status,
    token
  });
  const canOpenGeneralSettings =
    hasPermission(user, "settings.view") ||
    hasPermission(user, "settings.appearance") ||
    hasPermission(user, "settings.system_mode") ||
    hasPermission(user, "admin.full");
  const permittedViewIds = useMemo(() => {
    const views = [];
    if (canViewDashboard) views.push("dashboard");
    if (canViewAlerts || canViewScripts || canViewPreventivePlans || canViewPreventiveAutomation) views.push("alerts");
    if (canViewServiceOrders) views.push("service-orders");
    if (canViewInventory) views.push("inventory");
    return views;
  }, [canViewAlerts, canViewDashboard, canViewInventory, canViewPreventiveAutomation, canViewPreventivePlans, canViewScripts, canViewServiceOrders]);
  const canConfigureAlerts = hasPermission(user, "alerts.configure");
  const canConfigureAlertPrioritySettings = hasPermission(user, "alerts.configure");
  const canCommentAlerts = hasPermission(user, "alerts.comment");
  const canManageAlertSuggestions =
    hasPermission(user, "alerts.manage_suggestions") &&
    hasPermission(user, "service_orders.create_from_alert");
  const canManageScripts = hasPermission(user, "scripts.manage");
  const canRegisterScriptSimulation = hasPermission(user, "scripts.register_simulation");
  const canUseScriptsFromAlerts = hasPermission(user, "scripts.use_from_alert");
  const canViewScriptLogs = hasPermission(user, "script_logs.view");
  const canResolveScriptLogs = hasPermission(user, "script_logs.resolve");
  const canCreatePreventivePlans =
    hasPermission(user, "preventive_plans.create") &&
    hasPermission(user, "preventive_plans.prepare");
  const canCreatePreventiveServiceOrder =
    hasPermission(user, "preventive_plans.create_service_order") &&
    hasPermission(user, "service_orders.create");
  const canCreatePreventiveAutomation = hasPermission(user, "preventive_automation.create");
  const canUpdatePreventiveAutomation = hasPermission(user, "preventive_automation.update");
  const canDisablePreventiveAutomation = hasPermission(user, "preventive_automation.disable");
  const canDeletePreventiveAutomation = hasPermission(user, "preventive_automation.delete");
  const canRemovePreventiveAutomationAsset = hasPermission(user, "preventive_automation.remove_asset");
  const canManagePreventiveAutomationOverride = hasPermission(user, "preventive_automation.manage_asset_override");
  const canManageInventory =
    hasPermission(user, "inventory.create_asset") ||
    hasPermission(user, "inventory.edit_asset") ||
    hasPermission(user, "inventory.move_assets") ||
    hasPermission(user, "inventory.manage_segments");
  const sidebarWasCollapsedBeforeDrag = useRef(true);
  const sidebarAutoCloseTimer = useRef(null);
  const dragStartScrollY = useRef(0);
  const inventoryPreferenceHydrated = useRef(false);

  useEffect(() => {
    let active = true;

    fetchUserPreference(token, "inventory-workspace")
      .then(({ value }) => {
        if (!active || !value) return;
        setMachineAliases(value.aliases || {});
        setMachineObservations(value.observations || {});
        setRemovedPeripherals(value.removedPeripherals || {});
        setPeripheralHistory(value.peripheralHistory || {});
        setMaintenanceRecords(value.maintenanceRecords || {});
      })
      .catch(() => {
        // Local cache remains available when the backend preference has not been created yet.
      })
      .finally(() => {
        if (active) inventoryPreferenceHydrated.current = true;
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!inventoryPreferenceHydrated.current) return undefined;

    const timeoutId = window.setTimeout(() => {
      saveUserPreference(token, "inventory-workspace", {
        aliases: machineAliases,
        observations: machineObservations,
        removedPeripherals,
        peripheralHistory,
        maintenanceRecords
      }).catch(() => {});
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [
    machineAliases,
    machineObservations,
    maintenanceRecords,
    peripheralHistory,
    removedPeripherals,
    token
  ]);

  useEffect(() => {
    if (permittedViewIds.includes(activeView)) return;
    setActiveView(permittedViewIds[0] || "blocked");
  }, [activeView, permittedViewIds]);

  useEffect(() => {
    return () => {
      window.clearTimeout(sidebarAutoCloseTimer.current);
      window.clearTimeout(bulkPrintCleanupTimer.current);
      if (bulkPrintAfterprintHandler.current) {
        window.removeEventListener("afterprint", bulkPrintAfterprintHandler.current);
      }
      document.body.classList.remove("qr-print-mode", "bulk-qr-print-mode");
    };
  }, []);

  function saveInventoryTabs(updater) {
    const nextTabs = typeof updater === "function" ? updater(inventoryTabs) : updater;
    const normalized = normalizeInventoryTabs(nextTabs);
    localStorage.setItem(inventoryTabsKey, JSON.stringify(normalized));
    setInventoryTabs(normalized);
  }

  function saveInventoryTabMeta(updater) {
    setInventoryTabMeta((current) => {
      const next = normalizeInventoryTabMeta(typeof updater === "function" ? updater(current) : updater);
      localStorage.setItem(inventoryTabMetaKey, JSON.stringify(next));
      return next;
    });
  }

  function saveMaintenanceRecords(updater) {
    setMaintenanceRecords((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      localStorage.setItem(maintenanceRecordsKey, JSON.stringify(next));
      return next;
    });
  }

  async function changeSystemMode(mode) {
    const nextMode = mode === "business" ? "business" : "local";
    setSystemMode(nextMode);

    try {
      const response = await updateSystemSettings(token, { systemMode: nextMode });
      const savedMode = response.settings?.systemMode === "business" ? "business" : "local";
      setSystemMode(savedMode);
      notify(savedMode === "business" ? "Modo Business ativado." : "Modo Local ativado.", "ok");
    } catch (error) {
      setSystemMode(systemMode);
      notify(error.message, "danger");
    }
  }

  function updateInventoryMeta(kind, id, updates) {
    if (!id) return;

    saveInventoryTabMeta((current) => ({
      ...current,
      [kind]: {
        ...(current[kind] || {}),
        [id]: {
          ...(current[kind]?.[id] || {}),
          ...updates
        }
      }
    }));
  }

  function updateDeviceTabOwnership(deviceIds, targetSegment, targetTabId = activeInventoryTab.id) {
    const ids = Array.isArray(deviceIds) ? deviceIds : [deviceIds];
    const targetIsDefault = Boolean(targetSegment?.isDefault);

    saveInventoryTabMeta((current) => {
      const nextDevices = { ...(current.devices || {}) };

      for (const id of ids.filter(Boolean)) {
        const currentMeta = { ...(nextDevices[id] || {}) };

        if (targetIsDefault) {
          delete currentMeta.tabId;
          if (Object.keys(currentMeta).length) {
            nextDevices[id] = currentMeta;
          } else {
            delete nextDevices[id];
          }
        } else {
          nextDevices[id] = {
            ...currentMeta,
            tabId: targetTabId
          };
        }
      }

      return {
        ...current,
        devices: nextDevices
      };
    });
  }

  const alertTrend = useMemo(() => {
    return history.slice(0, 6).reverse().map((alert, index) => ({
      label: `#${index + 1}`,
      critical: alert.severity === "critical" ? 1 : 0,
      warning: alert.severity === "warning" ? 1 : 0
    }));
  }, [history]);
  const fallbackInventoryTabId = inventoryTabs[0]?.id || defaultInventoryTab.id;
  const activeInventoryTab = inventoryTabs.find((tab) => tab.id === activeInventoryTabId) || inventoryTabs[0] || defaultInventoryTab;
  const itemTabId = (kind, id) => inventoryTabMeta[kind]?.[id]?.tabId || fallbackInventoryTabId;
  const itemOrder = (kind, id, fallback) => {
    const order = inventoryTabMeta[kind]?.[id]?.order;
    return Number.isFinite(order) ? order : fallback;
  };
  const decoratedSegmentGroups = useMemo(
    () =>
      segmentGroups
        .map((group, index) => ({
          ...group,
          tabId: itemTabId("groups", group.id),
          order: itemOrder("groups", group.id, index)
        }))
        .sort((left, right) => left.order - right.order),
    [fallbackInventoryTabId, inventoryTabMeta, segmentGroups]
  );
  const decoratedSegments = useMemo(
    () =>
      segments
        .map((segment, index) => ({
          ...segment,
          tabId: segment.isDefault ? "shared" : itemTabId("segments", segment.id),
          order: itemOrder("segments", segment.id, index)
        }))
        .sort((left, right) => left.order - right.order),
    [fallbackInventoryTabId, inventoryTabMeta, segments]
  );
  const defaultSegmentIds = useMemo(
    () => new Set(decoratedSegments.filter((segment) => segment.isDefault).map((segment) => segment.id)),
    [decoratedSegments]
  );
  const decoratedAllDevices = useMemo(
    () =>
      allDevices.map((device, index) => {
        const isAvailableBackup = Boolean(device.isBackup) && device.backupStatus !== "in_use";
        const rawSegmentId = device.segmentId;
        const rawSegmentName = device.segmentName;
        const isGlobalUnorganized = !isAvailableBackup && defaultSegmentIds.has(rawSegmentId);

        return {
          ...device,
          backupRealSegmentId: device.backupOriginalSegmentId || rawSegmentId,
          backupRealSegmentName: device.backupOriginalSegmentName || rawSegmentName,
          segmentId: isAvailableBackup ? backupSegmentId : rawSegmentId,
          segmentName: isAvailableBackup ? backupSegmentName : rawSegmentName,
          tabId: isAvailableBackup
            ? "global-backup"
            : isGlobalUnorganized
              ? "global-unorganized"
              : itemTabId("devices", device.id),
          isGlobalBackup: isAvailableBackup,
          isGlobalUnorganized,
          order: itemOrder("devices", device.id, index)
        };
      }),
    [allDevices, defaultSegmentIds, fallbackInventoryTabId, inventoryTabMeta]
  );
  const activeAllDevices = useMemo(
    () => decoratedAllDevices.filter((device) => device.isGlobalBackup || device.isGlobalUnorganized || device.tabId === activeInventoryTab.id),
    [activeInventoryTab.id, decoratedAllDevices]
  );
  const activeMaintenanceSegmentIds = useMemo(
    () => {
      const next = new Set(
        activeAllDevices
          .filter((device) => device.maintenance || isMaintenanceSegmentName(device.segmentName))
          .map((device) => device.segmentId)
          .filter(Boolean)
      );

      for (const segment of decoratedSegments) {
        if (
          !segment.isDefault &&
          segment.tabId === activeInventoryTab.id &&
          isMaintenanceSegmentName(segment.name) &&
          Number(segment.machineCount || 0) > 0
        ) {
          next.add(segment.id);
        }
      }

      return next;
    },
    [activeAllDevices, activeInventoryTab.id, decoratedSegments]
  );
  const activeSegmentGroups = useMemo(
    () => decoratedSegmentGroups.filter((group) => group.tabId === activeInventoryTab.id),
    [activeInventoryTab.id, decoratedSegmentGroups]
  );
  const activeSegments = useMemo(() => {
    const activeNonDefaultSegments = decoratedSegments.filter(
      (segment) =>
        !segment.isDefault &&
        segment.tabId === activeInventoryTab.id &&
        (!isMaintenanceSegmentName(segment.name) || activeMaintenanceSegmentIds.has(segment.id))
    );
    const sharedDefaultSegments = decoratedSegments.filter((segment) => segment.isDefault);
    const backupSegment = decoratedAllDevices.some((device) => device.isBackup)
      ? [{
          id: backupSegmentId,
          name: backupSegmentName,
          color: "#f59e0b",
          isDefault: true,
          isBackupSegment: true,
          tabId: "shared",
          order: -1
        }]
      : [];

    return [...backupSegment, ...sharedDefaultSegments, ...activeNonDefaultSegments];
  }, [activeInventoryTab.id, activeMaintenanceSegmentIds, decoratedAllDevices, decoratedSegments]);
  const inventorySearchActive = Boolean(inventorySearch.trim());
  const inventorySearchSegments = useMemo(() => {
    const backupSegment = decoratedAllDevices.some((device) => device.isBackup)
      ? [{
          id: backupSegmentId,
          name: backupSegmentName,
          color: "#f59e0b",
          isDefault: true,
          isBackupSegment: true,
          tabId: "shared",
          order: -1
        }]
      : [];

    return [...backupSegment, ...decoratedSegments];
  }, [decoratedAllDevices, decoratedSegments]);
  const inventoryViewDevices = inventorySearchActive ? decoratedAllDevices : activeAllDevices;
  const inventoryViewSegments = inventorySearchActive ? inventorySearchSegments : activeSegments;
  const inventoryViewGroups = inventorySearchActive ? decoratedSegmentGroups : activeSegmentGroups;
  const inventorySegmentById = useMemo(
    () => new Map(inventoryViewSegments.map((segment) => [segment.id, segment])),
    [inventoryViewSegments]
  );
  const inventoryGroupById = useMemo(
    () => new Map(inventoryViewGroups.map((group) => [group.id, group])),
    [inventoryViewGroups]
  );
  const inventoryTabById = useMemo(
    () => new Map(inventoryTabs.map((tab) => [tab.id, tab])),
    [inventoryTabs]
  );
  const filteredInventoryDevices = useMemo(() => inventoryViewDevices.flatMap((device) => {
    const term = inventorySearch.trim().toLowerCase();
    if (!term) return [device];
    const segment = inventorySegmentById.get(device.segmentId);
    const groupId = segment?.groupId || decoratedSegmentGroups.find(
      (item) => (item.segmentIds || []).includes(device.segmentId)
    )?.id;
    const group = groupId ? inventoryGroupById.get(groupId) : null;
    const tab = inventoryTabById.get(device.tabId);

    const matches = [
      device.name,
      machineAliases[device.id],
      device.ip,
      device.statusLabel,
      device.segmentName,
      segment?.name,
      group?.name,
      tab?.name,
      device.assetType,
      device.type,
      device.source,
      device.manualAsset?.brand,
      device.manualAsset?.model,
      device.manualAsset?.assetTag,
      device.manualAsset?.macAddress,
      device.manualAsset?.hostname,
      device.manualAsset?.location,
      device.hardware?.os,
      device.hardware?.manufacturer,
      device.hardware?.model,
      device.hardware?.assetTag,
      device.hardware?.serialNumber,
      device.hardware?.macAddress,
      device.hardware?.software?.join(" ")
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));

    return matches
      ? [{
          ...device,
          inventorySearchTabName: tab?.name || (device.isGlobalBackup ? "Backup" : "Não organizadas")
        }]
      : [];
  }), [
    decoratedSegmentGroups,
    inventoryGroupById,
    inventorySearch,
    inventorySegmentById,
    inventoryTabById,
    inventoryViewDevices,
    machineAliases
  ]);
  const selectedAssets = useMemo(
    () => activeAllDevices.filter((device) => selectedAssetIds.has(device.id)),
    [activeAllDevices, selectedAssetIds]
  );
  const {
    handleDragEnd: handleInventoryDragEnd,
    machinesBySegment,
    sensors
  } = useInventoryDragAndDrop({
    devices: inventoryViewDevices,
    filteredDevices: filteredInventoryDevices,
    segments: inventoryViewSegments,
    selectedAssetIds,
    onMoveMachine: handleMoveMachine,
    onMoveMachines: handleMoveMachines
  });

  useEffect(() => {
    const visibleIds = new Set(filteredInventoryDevices.map((device) => device.id));

    setSelectedAssetIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));

      if (next.size === current.size) return current;
      if (next.size < 2) setBulkMoveTarget("");
      return next;
    });
  }, [filteredInventoryDevices]);

  useEffect(() => {
    if (!inventoryTabs.some((tab) => tab.id === activeInventoryTabId)) {
      setActiveInventoryTabId(fallbackInventoryTabId);
    }
  }, [activeInventoryTabId, fallbackInventoryTabId, inventoryTabs]);

  useEffect(() => {
    localStorage.setItem(activeInventoryTabKey, activeInventoryTab.id);
    setSelectedInventoryGroup("all");
    setSelectedInventorySegment("all");
    setInventorySearch("");
    clearAssetSelection();
  }, [activeInventoryTab.id]);

  useEffect(() => {
    if (selectedInventorySegment === "all") return;

    const segment = activeSegments.find((item) => item.id === selectedInventorySegment);

    if (!segment) {
      setSelectedInventorySegment("all");
    }
  }, [activeSegments, selectedInventorySegment]);

  useEffect(() => {
    if (selectedInventoryGroup === "all" || selectedInventoryGroup === "ungrouped") return;

    if (!activeSegmentGroups.some((group) => group.id === selectedInventoryGroup)) {
      setSelectedInventoryGroup("all");
      setSelectedInventorySegment("all");
    }
  }, [activeSegmentGroups, selectedInventoryGroup]);

  function selectInventoryGroup(groupId) {
    setSelectedInventoryGroup(groupId);
    setSelectedInventorySegment("all");
  }

  function selectInventorySegment(segmentId) {
    setSelectedInventorySegment(segmentId);

    if (segmentId === "all") {
      setSelectedInventoryGroup("all");
      return;
    }

    const segment = activeSegments.find((item) => item.id === segmentId);
    if (segment) {
      setSelectedInventoryGroup(segment.groupId || "ungrouped");
    }
  }

  async function selectDevice(id) {
    setSelectedId(id);
    const details = await fetchDevice(token, id);
    setSelectedDevice(details.device);
  }

  async function handleEvaluateAlerts() {
    try {
      const result = await evaluateAlerts(token);
      setAlerts(result.alerts || []);
      setAlertRules(result.rules || []);
      setServiceOrderSuggestions(result.suggestions || []);
      const correlationData = await fetchAlertCorrelations(token).catch(() => ({ correlations: [] }));
      setAlertCorrelations(correlationData.correlations || []);
      const created = result.createdSuggestions?.length || 0;
      notify(
        created
          ? `${created} sugestão(ões) de OS criada(s) a partir dos avisos.`
          : "Avisos avaliados. Nenhuma nova sugestão foi necessária.",
        "ok"
      );
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleAcceptSuggestion(suggestionId) {
    try {
      const acceptedSuggestion = serviceOrderSuggestions.find((suggestion) => suggestion.id === suggestionId);
      const result = await acceptServiceOrderSuggestion(token, suggestionId);
      const serviceOrder = result.serviceOrder;
      const assetId = serviceOrder?.assetId || acceptedSuggestion?.assetId;
      const linkedMachine = assetId
        ? allDevices.find((device) => String(device.id) === String(assetId))
        : null;

      setServiceOrderSuggestions((current) => current.filter((suggestion) => suggestion.id !== suggestionId));

      if (linkedMachine && serviceOrder?.id) {
        await ensureMachineInMaintenanceForServiceOrder(linkedMachine, serviceOrder);
      }

      notify(`OS criada a partir do aviso: ${serviceOrder?.number || "registrada"}.`, "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleAddAlertComment(alertId, message) {
    try {
      await createAlertComment(token, alertId, message);
      notify("Comentário registrado no aviso.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleRejectSuggestion(suggestionId) {
    const reason = "Recusado pelo painel de avisos.";
    try {
      await rejectServiceOrderSuggestion(token, suggestionId, reason);
      setServiceOrderSuggestions((current) => current.filter((suggestion) => suggestion.id !== suggestionId));
      notify("Sugestão de OS recusada.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleUpdateAlertRule(ruleId, payload) {
    try {
      const response = await updateAlertRule(token, ruleId, payload);
      setAlertRules((current) =>
        current.map((rule) => (rule.id === ruleId ? response.rule : rule))
      );
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleSaveAlertPrioritySettings(settings) {
    try {
      const response = await updateAlertSettings(token, settings);
      const nextPrioritySettings = normalizePrioritySettings(response.settings);
      setAlertPrioritySettings(nextPrioritySettings);
      setAlertPriorityColors(nextPrioritySettings.priorityColors);
      notify("Configurações de prioridade dos avisos salvas.", "ok");
      return nextPrioritySettings;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleAnalyzeMaintenanceScript(payload) {
    try {
      const response = await analyzeMaintenanceScript(token, payload);
      notify("Resumo estimado gerado. Revise manualmente antes de salvar.", "ok");
      return response.analysis;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleSaveMaintenanceScript(payload, scriptId = null) {
    try {
      const response = scriptId
        ? await updateMaintenanceScript(token, scriptId, payload)
        : await createMaintenanceScript(token, payload);
      setMaintenanceScripts((current) => {
        const exists = current.some((script) => script.id === response.script.id);
        return exists
          ? current.map((script) => (script.id === response.script.id ? response.script : script))
          : [response.script, ...current];
      });
      notify(scriptId ? "Script de manutenção atualizado." : "Script de manutenção cadastrado.", "ok");
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleDeactivateMaintenanceScript(scriptId) {
    try {
      const response = await deleteMaintenanceScript(token, scriptId);
      setMaintenanceScripts((current) =>
        current.map((script) => (script.id === response.script.id ? response.script : script))
      );
      notify("Script de manutenção desativado.", "ok");
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleRegisterMaintenanceScriptSimulation(scriptId, payload) {
    try {
      await registerMaintenanceScriptSimulation(token, scriptId, payload);
      notify("Registro criado. Nenhum comando foi executado.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleUseSuggestionScript(suggestionId, scriptId, payload) {
    try {
      await executeSuggestionScript(token, suggestionId, scriptId, payload);
      notify("Observação registrada. Nenhum comando foi executado.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleAcknowledgeScriptLog(logId) {
    try {
      await acknowledgeScriptLog(token, logId);
      notify("Log marcado como revisado.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleApplyScriptLogSuggestedSolution(logId, payload) {
    try {
      await applyScriptLogSuggestedSolution(token, logId, payload);
      notify("Acao corretiva registrada. Nenhum comando foi executado.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleCancelScriptValidation(validationId) {
    try {
      await cancelScriptValidation(token, validationId);
      notify("Observação cancelada.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleCreatePreventivePlan(payload) {
    try {
      const response = await createPreventivePlan(token, payload);
      setPreventivePlans((current) => [
        response.preventivePlan,
        ...current.filter((plan) => plan.id !== response.preventivePlan.id)
      ]);
      notify(
        payload.automation?.enabled
          ? "Plano preventivo automatizado registrado. Nenhum comando foi executado."
          : "Preventiva registrada. Nenhum comando foi executado.",
        "ok"
      );
      await loadData(true);
      return response.preventivePlan;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleCreatePreventivePlanServiceOrder(planId) {
    try {
      const response = await createPreventivePlanServiceOrder(token, planId);
      setPreventivePlans((current) =>
        current.map((plan) => (plan.id === response.preventivePlan.id ? response.preventivePlan : plan))
      );
      setServiceOrders((current) => [
        response.serviceOrder,
        ...current.filter((order) => order.id !== response.serviceOrder.id)
      ]);
      notify(`OS preventiva ${response.serviceOrder.number} criada.`, "ok");
      await loadData(true);
      return response;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleSavePreventiveAutomationPlan(planId, payload) {
    try {
      const previousPlan = planId
        ? preventiveAutomationPlans.find((plan) => String(plan.id) === String(planId))
        : null;
      const response = planId
        ? await updatePreventiveAutomationPlan(token, planId, payload)
        : await createPreventiveAutomationPlan(token, payload);
      setPreventiveAutomationPlans((current) => {
        const exists = current.some((plan) => plan.id === response.preventiveAutomationPlan.id);
        return exists
          ? current.map((plan) => (plan.id === response.preventiveAutomationPlan.id ? response.preventiveAutomationPlan : plan))
          : [response.preventiveAutomationPlan, ...current];
      });
      const statusChanged = previousPlan && typeof payload?.active === "boolean" && previousPlan.active !== payload.active;
      const statusMessage = statusChanged && payload.active === false
        ? "Automação pausada. As agendas futuras foram desativadas."
        : statusChanged && payload.active === true
          ? "Automação reativada. As agendas foram recalculadas."
          : null;
      notify(statusMessage || (planId ? "Automação preventiva atualizada." : "Automação preventiva criada."), "ok");
      await loadData(true);
      return response.preventiveAutomationPlan;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleDisablePreventiveAutomationPlan(planId) {
    try {
      const response = await disablePreventiveAutomationPlan(token, planId);
      setPreventiveAutomationPlans((current) =>
        current.map((plan) => (plan.id === response.preventiveAutomationPlan.id ? response.preventiveAutomationPlan : plan))
      );
      notify("Automação preventiva desativada.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleDeletePreventiveAutomationPlan(planId) {
    try {
      await deletePreventiveAutomationPlan(token, planId);
      notify("Plano de automação excluído. Histórico e auditoria foram preservados.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleSavePreventiveAutomationAssetOverride(planId, assetId, payload) {
    try {
      const response = await savePreventiveAutomationAssetOverride(token, planId, assetId, payload);
      notify("Recorrência personalizada atualizada para esta máquina.", "ok");
      await loadData(true);
      return response.automationAsset;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleRemovePreventiveAutomationAssetOverride(planId, assetId) {
    try {
      const response = await removePreventiveAutomationAssetOverride(token, planId, assetId);
      notify("A máquina voltou a usar a recorrência padrão do plano.", "ok");
      await loadData(true);
      return response.automationAsset;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleRemoveAssetFromPreventiveAutomationPlan(planId, assetId) {
    try {
      const response = await removeAssetFromPreventiveAutomationPlan(token, planId, assetId);
      notify("Máquina removida do plano. Agendas futuras foram desativadas.", "ok");
      await loadData(true);
      return response;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleFetchPreventiveAutomationAsset(planId, assetId) {
    const response = await fetchPreventiveAutomationAsset(token, planId, assetId);
    return response.automationAsset;
  }

  function getServiceOrderModeError(payload) {
    const title = payload?.title?.trim() || "";
    const description = payload?.description?.trim() || "";
    const category = payload?.category?.trim() || "";
    const requesterName = payload?.requesterName?.trim() || "";

    if (title.length < 3) return "Informe um titulo com pelo menos 3 caracteres.";

    if (systemMode === "business") {
      if (!payload?.environmentId) {
        return "No modo Business, selecione um cliente para abrir a Ordem de Serviço.";
      }
      if (!payload?.assetId) return "No modo Business, vincule uma máquina/ativo à OS.";
      if (!requesterName) return "No modo Business, informe o solicitante.";
      if (!category) return "No modo Business, informe a categoria da OS.";
      if (!description) return "No modo Business, descreva a solicitacao.";
    }

    if (systemMode !== "business") {
      if (!description) return "Informe as observações do problema.";
      if (!category) return "Informe a categoria da OS.";
      if (!requesterName) return "Informe o solicitante.";
    }

    return "";
  }

  function findDecoratedDevice(deviceId) {
    return decoratedAllDevices.find((device) => device.id === deviceId) ||
      allDevices.find((device) => device.id === deviceId) ||
      devices.find((device) => device.id === deviceId);
  }

  function addServiceOrderHistoryToState(orderId, event) {
    if (!event) return;

    setServiceOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, history: [event, ...(order.history || [])] } : order
      )
    );
  }

  async function addServiceOrderSystemHistory(orderId, payload) {
    try {
      const response = await addServiceOrderHistory(token, orderId, payload);
      addServiceOrderHistoryToState(orderId, response.event);
      return response.event;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    }
  }

  async function handleCreateServiceOrder(payload) {
    const modeError = getServiceOrderModeError(payload);
    if (modeError) {
      notify(modeError, "danger");
      return null;
    }

    setServiceOrderSaving(true);
    try {
      const response = await createServiceOrder(token, payload);
      setServiceOrders((current) => [response.serviceOrder, ...current]);
      if (response.serviceOrder.assetId) {
        const linkedMachine = findDecoratedDevice(response.serviceOrder.assetId);
        await ensureMachineInMaintenanceForServiceOrder(linkedMachine, response.serviceOrder);
      }
      notify(`Ordem ${response.serviceOrder.number} criada.`, "ok");
      return response.serviceOrder;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    } finally {
      setServiceOrderSaving(false);
    }
  }

  async function handleUpdateServiceOrder(id, payload) {
    setServiceOrderSaving(true);
    try {
      const previousOrder = serviceOrders.find((order) => order.id === id);
      const response = await updateServiceOrder(token, id, payload);
      setServiceOrders((current) =>
        current.map((order) => (order.id === id ? response.serviceOrder : order))
      );
      if (payload.assetId && payload.assetId !== previousOrder?.assetId) {
        const linkedMachine = findDecoratedDevice(payload.assetId);
        await ensureMachineInMaintenanceForServiceOrder(linkedMachine, response.serviceOrder);
      }
      notify("Ordem de Serviço atualizada.", "ok");
      return response.serviceOrder;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    } finally {
      setServiceOrderSaving(false);
    }
  }

  async function handleAddServiceOrderHistory(id, payload) {
    try {
      const response = await addServiceOrderHistory(token, id, payload);
      setServiceOrders((current) =>
        current.map((order) =>
          order.id === id ? { ...order, history: [response.event, ...(order.history || [])] } : order
        )
      );
      notify("Registro adicionado ao historico.", "ok");
      return response.event;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    }
  }

  async function handleDeleteServiceOrder(order) {
    if (!order) return false;

    if (order.backupAssetId) {
      notify("Esta OS possui uma máquina Backup em uso. Devolva o Backup ou finalize a OS antes de excluir.", "danger");
      return false;
    }

    const linkedMachine = findDecoratedDevice(order.assetId);
    if (linkedMachine && (linkedMachine.maintenance || isMaintenanceSegmentName(linkedMachine.segmentName))) {
      notify("Esta OS possui uma máquina em manutenção. Finalize a OS ou retire a máquina da manutenção antes de excluir.", "danger");
      return false;
    }

    setServiceOrderSaving(true);
    try {
      await deleteServiceOrder(token, order.id);
      setServiceOrders((current) => current.filter((item) => item.id !== order.id));
      notify(`Ordem ${order.number} excluida.`, "ok");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    } finally {
      setServiceOrderSaving(false);
    }
  }

  function isMaintenanceServiceOrder(order) {
    return (
      Boolean(order?.assetId) &&
      String(order?.category || "").trim().toLowerCase() === "manutencao"
    );
  }

  async function handleChangeServiceOrderStatus(order, statusValue) {
    if (!order || order.status === statusValue) return order;

    setServiceOrderSaving(true);
    try {
      const response = await updateServiceOrderStatus(token, order.id, statusValue);
      setServiceOrders((current) =>
        current.map((item) => (item.id === order.id ? response.serviceOrder : item))
      );
      notify("Status da OS atualizado.", "ok");

      if (response.serviceOrder.closedAt && response.serviceOrder.backupAssetId) {
        await releaseBackupForServiceOrder(response.serviceOrder, { finalized: true });
      }

      if (response.serviceOrder.closedAt && response.serviceOrder.assetId) {
        const asset = findDecoratedDevice(response.serviceOrder.assetId);

        if (asset && (asset.maintenance || isMaintenanceSegmentName(asset.segmentName))) {
          const removedFromMaintenance = await removeMachineFromMaintenance(asset, { serviceOrder: response.serviceOrder });
          if (removedFromMaintenance) {
            await addServiceOrderSystemHistory(response.serviceOrder.id, {
              eventType: "maintenance",
              message: "OS finalizada e máquina retirada da manutenção.",
              oldValue: asset.segmentName || "Manutenção"
            });
          }
        }
      }

      return response.serviceOrder;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    } finally {
      setServiceOrderSaving(false);
    }
  }

  function updateDeviceSegmentInState(deviceId, segmentId, segmentName, extra = {}) {
    const update = (device) =>
      device.id === deviceId ? { ...device, segmentId, segmentName, ...extra } : device;

    setAllDevices((current) => current.map(update));
    setDevices((current) => current.map(update));
    setSelectedDevice((current) => (current?.id === deviceId ? update(current) : current));
  }

  async function handleMoveMachine(machine, segmentId, options = {}) {
    if (!machine || !segmentId || machine.segmentId === segmentId) {
      setMoveModal(null);
      return false;
    }

    if (segmentId === backupSegmentId) {
      notify("Use a ação Backup para enviar máquinas para a área de reserva.", "danger");
      return false;
    }

    if (machine.isBackup && machine.backupStatus !== "in_use" && !options.allowBackupMove) {
      notify("Máquinas Backup disponíveis só podem ser alocadas temporariamente por uma OS.", "danger");
      return false;
    }

    if (!options.forceSingle && selectedAssetIds.has(machine.id) && selectedAssetIds.size > 1) {
      return handleMoveMachines(Array.from(selectedAssetIds), segmentId, options);
    }

    const target =
      activeSegments.find((segment) => segment.id === segmentId) ||
      decoratedSegments.find((segment) => segment.id === segmentId) ||
      segments.find((segment) => segment.id === segmentId);
    if (!target || target.isBackupSegment) {
      notify("Segmento de destino invalido.", "danger");
      return false;
    }
    const previousSegment = { id: machine.segmentId, name: machine.segmentName };

    updateDeviceTabOwnership(machine.id, target, options.targetTabId);
    updateDeviceSegmentInState(machine.id, segmentId, target?.name || "Segmento", options.reason === "maintenance" ? { maintenance: true } : {});
    setMoveModal(null);

    try {
      const response = await updateDeviceSegment(token, machine.id, segmentId, options.reason ? { reason: options.reason } : {});
      updateDeviceSegmentInState(
        machine.id,
        response.device.segmentId,
        response.device.segmentName,
        options.reason === "maintenance" ? { maintenance: true } : {}
      );
      notify(`${machine.name} movida para ${response.device.segmentName}.`, "ok");
      await loadData(true);
      clearAssetSelection();
      return true;
    } catch (error) {
      updateDeviceTabOwnership(
        machine.id,
        activeSegments.find((segment) => segment.id === previousSegment.id) ||
          decoratedSegments.find((segment) => segment.id === previousSegment.id) ||
          segments.find((segment) => segment.id === previousSegment.id),
        machine.tabId
      );
      updateDeviceSegmentInState(machine.id, previousSegment.id, previousSegment.name);
      notify(error.message, "danger");
      return false;
    }
  }

  async function handleMoveMachines(machineIds, segmentId, options = {}) {
    if (!machineIds.length || !segmentId) return false;

    if (segmentId === backupSegmentId) {
      notify("Use a ação Backup para enviar máquinas para a área de reserva.", "danger");
      return false;
    }

    const target =
      activeSegments.find((segment) => segment.id === segmentId) ||
      decoratedSegments.find((segment) => segment.id === segmentId) ||
      segments.find((segment) => segment.id === segmentId);
    if (!target || target.isBackupSegment) {
      notify("Segmento de destino invalido.", "danger");
      return false;
    }
    const machinesToMove = activeAllDevices.filter(
      (device) => machineIds.includes(device.id) && device.segmentId !== segmentId
    );
    const blockedBackup = machinesToMove.find((machine) => machine.isBackup && machine.backupStatus !== "in_use" && !options.allowBackupMove);

    if (blockedBackup) {
      notify("Máquinas Backup disponíveis só podem ser alocadas temporariamente por uma OS.", "danger");
      return false;
    }

    if (!machinesToMove.length) {
      clearAssetSelection();
      return false;
    }

    const previous = new Map(machinesToMove.map((machine) => [
      machine.id,
      { id: machine.segmentId, name: machine.segmentName }
    ]));

    updateDeviceTabOwnership(machinesToMove.map((machine) => machine.id), target, options.targetTabId);
    machinesToMove.forEach((machine) => {
      updateDeviceSegmentInState(machine.id, segmentId, target?.name || "Segmento");
    });
    setMoveModal(null);

    try {
      await Promise.all(
        machinesToMove.map((machine) =>
          updateDeviceSegment(token, machine.id, segmentId, options.reason ? { reason: options.reason } : {})
        )
      );
      notify(`${machinesToMove.length} equipamentos movidos para ${target?.name || "Segmento"}.`, "ok");
      await loadData(true);
      clearAssetSelection();
      return true;
    } catch (error) {
      machinesToMove.forEach((machine) => {
        const fallback = previous.get(machine.id);
        updateDeviceTabOwnership(
          machine.id,
          activeSegments.find((segment) => segment.id === fallback.id) ||
            decoratedSegments.find((segment) => segment.id === fallback.id) ||
            segments.find((segment) => segment.id === fallback.id),
          machine.tabId
        );
        updateDeviceSegmentInState(machine.id, fallback.id, fallback.name);
      });
      notify(error.message, "danger");
      return false;
    }
  }

  function handleSelectAsset(machine, { additive = false } = {}) {
    setSelectedAssetIds((current) => {
      const next = additive ? new Set(current) : new Set();

      if (additive && next.has(machine.id)) {
        next.delete(machine.id);
      } else {
        next.add(machine.id);
      }

      return next;
    });
  }

  function toggleAssetSelection(machineId) {
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      if (next.has(machineId)) {
        next.delete(machineId);
      } else {
        next.add(machineId);
      }
      return next;
    });
  }

  function clearAssetSelection() {
    setSelectedAssetIds(new Set());
    setBulkMoveTarget("");
  }

  function handleBulkMove() {
    if (!bulkMoveTarget || !selectedAssetIds.size) return;
    handleMoveMachines(Array.from(selectedAssetIds), bulkMoveTarget);
  }

  function finishBulkPrint() {
    document.body.classList.remove("qr-print-mode", "bulk-qr-print-mode");
    setBulkPrintAssets([]);
    window.clearTimeout(bulkPrintCleanupTimer.current);
    if (bulkPrintAfterprintHandler.current) {
      window.removeEventListener("afterprint", bulkPrintAfterprintHandler.current);
      bulkPrintAfterprintHandler.current = null;
    }
  }

  function handleBulkPrint() {
    if (!selectedAssets.length) return;

    finishBulkPrint();
    setBulkPrintAssets(selectedAssets);
    document.body.classList.add("qr-print-mode", "bulk-qr-print-mode");
    bulkPrintAfterprintHandler.current = finishBulkPrint;
    window.addEventListener("afterprint", bulkPrintAfterprintHandler.current);
  }

  function handleBulkPrintReady() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        bulkPrintCleanupTimer.current = window.setTimeout(finishBulkPrint, 1800);
      });
    });
  }

  async function handleToggleBackup(machine, desiredState) {
    if (!machine) return false;

    if (machine.backupStatus === "in_use" && desiredState === false) {
      notify("Esta máquina Backup está em uso por uma OS. Devolva ou finalize a OS antes de remover o Backup.", "danger");
      return false;
    }

    const nextIsBackup = desiredState ?? !machine.isBackup;
    const originalSegmentId =
      machine.backupRealSegmentId ||
      machine.backupOriginalSegmentId ||
      (machine.segmentId === backupSegmentId ? "" : machine.segmentId);
    const originalSegmentName =
      machine.backupRealSegmentName ||
      machine.backupOriginalSegmentName ||
      (machine.segmentId === backupSegmentId ? "" : machine.segmentName);

    try {
      const response = await updateDeviceBackup(token, machine.id, {
        isBackup: nextIsBackup,
        status: "available",
        originalSegmentId,
        originalSegmentName
      });
      upsertDeviceInState(response.device);
      notify(nextIsBackup ? `${machine.name} marcada como Backup.` : `${machine.name} removida da area de Backup.`, "ok");
      await loadData(true);
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function handleBulkMarkBackup() {
    const machines = selectedAssets.filter((machine) => !machine.isBackup);
    if (!machines.length) {
      notify("As máquinas selecionadas já estão marcadas como Backup.", "ok");
      clearAssetSelection();
      return false;
    }

    try {
      await Promise.all(
        machines.map((machine) =>
          updateDeviceBackup(token, machine.id, {
            isBackup: true,
            status: "available",
            originalSegmentId:
              machine.backupRealSegmentId ||
              machine.backupOriginalSegmentId ||
              (machine.segmentId === backupSegmentId ? "" : machine.segmentId),
            originalSegmentName:
              machine.backupRealSegmentName ||
              machine.backupOriginalSegmentName ||
              (machine.segmentId === backupSegmentId ? "" : machine.segmentName)
          })
        )
      );
      notify(`${machines.length} máquinas marcadas como Backup.`, "ok");
      clearAssetSelection();
      await loadData(true);
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  function upsertDeviceInState(device) {
    setAllDevices((current) => {
      if (current.some((item) => item.id === device.id)) {
        return current.map((item) => (item.id === device.id ? device : item));
      }
      return [...current, device];
    });
    setDevices((current) => {
      if (current.some((item) => item.id === device.id)) {
        return current.map((item) => (item.id === device.id ? device : item));
      }
      return current;
    });
    setSelectedDevice((current) => (current?.id === device.id ? device : current));
  }

  function appendDeviceHistoryEvent(machineId, event) {
    const update = (device) =>
      device.id === machineId
        ? { ...device, assetHistory: [event, ...(device.assetHistory || [])] }
        : device;

    setAllDevices((current) => current.map(update));
    setDevices((current) => current.map(update));
    setSelectedDevice((current) => (current?.id === machineId ? update(current) : current));
  }

  async function getOrCreateMaintenanceSegment(sourceGroupId = "", targetTabId = activeInventoryTab.id) {
    const existingActive = decoratedSegments.find(
      (segment) =>
        !segment.isDefault &&
        segment.tabId === targetTabId &&
        isMaintenanceSegmentName(segment.name) &&
        getSegmentGroupId(segment, decoratedSegmentGroups) === sourceGroupId
    );
    if (existingActive) return existingActive;

    const response = await createSegment(token, {
      name: "Manutenção",
      color: "#f59e0b",
      groupId: sourceGroupId || null,
      systemSegment: "maintenance"
    });
    const nextSegment = { ...response.segment, groupId: response.segment.groupId || sourceGroupId };
    const targetSiblings = decoratedSegments.filter(
      (segment) =>
        !segment.isDefault &&
        segment.tabId === targetTabId &&
        getSegmentGroupId(segment, decoratedSegmentGroups) === sourceGroupId
    );

    setSegments((current) => upsertSegmentList(current, nextSegment));
    updateInventoryMeta("segments", response.segment.id, {
      tabId: targetTabId,
      order: targetSiblings.length
    });
    if (sourceGroupId) {
      saveSegmentGroups(assignSegmentToGroup(segmentGroups, response.segment.id, sourceGroupId));
    }

    return nextSegment;
  }

  async function ensureMachineInMaintenanceForServiceOrder(machine, serviceOrder) {
    if (!machine || !serviceOrder?.id) return false;

    const orderLabel = serviceOrder.number ? `#${serviceOrder.number}` : "";

    if (machine.maintenance || isMaintenanceSegmentName(machine.segmentName)) {
      await addServiceOrderSystemHistory(serviceOrder.id, {
        eventType: "maintenance",
        message: "Máquina vinculada. Ela já estava em manutenção.",
        newValue: machine.name
      });
      return true;
    }

    try {
      const targetTabId =
        machine.tabId && machine.tabId !== "global-unorganized"
          ? machine.tabId
          : serviceOrder.environmentId || activeInventoryTab.id;
      const originSegment = decoratedSegments.find((segment) => segment.id === machine.segmentId);
      const originGroupId = originSegment ? getSegmentGroupId(originSegment, decoratedSegmentGroups) : "";
      const maintenanceSegment = await getOrCreateMaintenanceSegment(originGroupId, targetTabId);
      const previousSegment = machine.segmentName || "Não organizadas";
      const maintenanceRecord = {
        active: true,
        origin: {
          tabId: targetTabId,
          groupId: originGroupId,
          segmentId: machine.segmentId,
          segmentName: previousSegment
        }
      };

      const moved = await handleMoveMachine(machine, maintenanceSegment.id, {
        reason: "maintenance",
        targetTabId,
        forceSingle: true
      });
      if (!moved) return false;

      saveMaintenanceRecords((current) => ({
        ...current,
        [machine.id]: maintenanceRecord
      }));
      updateDeviceSegmentInState(machine.id, maintenanceSegment.id, maintenanceSegment.name, {
        maintenance: true,
        maintenanceOrigin: maintenanceRecord.origin
      });
      appendDeviceHistoryEvent(machine.id, {
        id: `${machine.id}-service-order-maintenance-${Date.now()}`,
        createdAt: new Date().toISOString(),
        userName: user.name,
        eventType: "maintenance",
        message: `Máquina colocada em manutenção automaticamente pela OS ${orderLabel}.`,
        oldValue: previousSegment,
        newValue: maintenanceSegment.name
      });
      await addServiceOrderSystemHistory(serviceOrder.id, {
        eventType: "maintenance",
        message: "Máquina vinculada e colocada em manutenção.",
        oldValue: previousSegment,
        newValue: maintenanceSegment.name
      });
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function putMachineInMaintenance(machine) {
    if (!machine) return false;

    try {
      if (machine.maintenance || isMaintenanceSegmentName(machine.segmentName)) {
        return removeMachineFromMaintenance(machine);
      }

      const originSegment = activeSegments.find((segment) => segment.id === machine.segmentId);
      const originGroupId = originSegment ? getSegmentGroupId(originSegment, activeSegmentGroups) : "";
      const maintenanceSegment = await getOrCreateMaintenanceSegment(originGroupId);
      const previousSegment = machine.segmentName || "Não organizadas";
      const maintenanceRecord = {
        active: true,
        origin: {
          tabId: activeInventoryTab.id,
          groupId: originGroupId,
          segmentId: machine.segmentId,
          segmentName: previousSegment
        }
      };

      const moved = await handleMoveMachine(machine, maintenanceSegment.id, { reason: "maintenance" });
      if (!moved) return false;
      saveMaintenanceRecords((current) => ({
        ...current,
        [machine.id]: maintenanceRecord
      }));
      updateDeviceSegmentInState(machine.id, maintenanceSegment.id, maintenanceSegment.name, {
        maintenance: true,
        maintenanceOrigin: maintenanceRecord.origin
      });
      appendDeviceHistoryEvent(machine.id, {
        id: `${machine.id}-maintenance-${Date.now()}`,
        createdAt: new Date().toISOString(),
        userName: user.name,
        eventType: "maintenance",
        message: "Máquina colocada em manutenção",
        oldValue: previousSegment,
        newValue: maintenanceSegment.name
      });

      const hasOpenMaintenanceOrder = serviceOrders.some(
        (order) =>
          order.assetId === machine.id &&
          isMaintenanceServiceOrder(order) &&
          order.status !== "closed"
      );

      if (!hasOpenMaintenanceOrder) {
        const response = await createServiceOrder(token, {
          title: `Manutenção - ${machine.name}`,
          description: `Máquina ${machine.name} colocada em manutenção. Preencha o diagnóstico, atendimento e solução antes de finalizar.`,
          priority: "medium",
          category: "Manutenção",
          assetId: machine.id,
          environmentId: activeInventoryTab.id,
          environmentName: activeInventoryTab.name || "Novo ambiente",
          requesterName: user.name,
          assignedTechnicianName: "",
          notes: `Origem: ${previousSegment}`
        });

        setServiceOrders((current) => [response.serviceOrder, ...current]);
      }

      notify(`${machine.name} colocada em manutencao.`, "ok");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function removeMachineFromMaintenance(machine, options = {}) {
    if (!machine) return false;

    const serviceOrderLabel = options.serviceOrder?.number ? `#${options.serviceOrder.number}` : "";
    const record = maintenanceRecords[machine.id];
    const origin = record?.origin || machine.maintenanceOrigin;
    const fallbackSegment =
      activeSegments.find((segment) => segment.isDefault) ||
      decoratedSegments.find((segment) => segment.isDefault);
    const originSegment =
      origin?.segmentId &&
      !isMaintenanceSegmentName(origin.segmentName) &&
      (activeSegments.find((segment) => segment.id === origin.segmentId) ||
        decoratedSegments.find((segment) => segment.id === origin.segmentId) ||
        segments.find((segment) => segment.id === origin.segmentId));
    const targetSegment = originSegment || fallbackSegment;

    if (!targetSegment) {
      notify("Não foi possível localizar o segmento de retorno.", "danger");
      return false;
    }

    const machineForMove = { ...machine, maintenance: true };
    const moved = await handleMoveMachine(machineForMove, targetSegment.id, {
      reason: "maintenance_exit",
      targetTabId: origin?.tabId || machine.tabId || activeInventoryTab.id
    });
    if (!moved) return false;

    saveMaintenanceRecords((current) => {
      const next = { ...current };
      delete next[machine.id];
      return next;
    });
    updateDeviceSegmentInState(machine.id, targetSegment.id, targetSegment.name, {
      maintenance: false,
      maintenanceOrigin: null
    });
    appendDeviceHistoryEvent(machine.id, {
      id: `${machine.id}-maintenance-exit-${Date.now()}`,
      createdAt: new Date().toISOString(),
      userName: user.name,
      eventType: "maintenance",
      message: options.serviceOrder
        ? originSegment
          ? `Máquina retirada da manutenção automaticamente pela finalização da OS ${serviceOrderLabel}.`
          : `Máquina retirada da manutenção automaticamente pela finalização da OS ${serviceOrderLabel}, mas o segmento original não existe mais. Movida para Não organizadas.`
        : originSegment
          ? "Máquina retirada da manutenção"
          : "Máquina retirada da manutenção, mas o segmento original não existe mais. Movida para Não organizadas.",
      oldValue: machine.segmentName || "Manutenção",
      newValue: targetSegment.name
    });
    notify(`${machine.name} retirada da manutencao.`, "ok");
    return true;
  }

  function getDefaultInventorySegment() {
    return activeSegments.find((segment) => segment.isDefault && !segment.isBackupSegment) ||
      decoratedSegments.find((segment) => segment.isDefault && !segment.isBackupSegment) ||
      segments.find((segment) => segment.isDefault);
  }

  function getRealBackupLocation(machine) {
    const fallback = getDefaultInventorySegment();
    const segmentId =
      machine?.backupRealSegmentId ||
      machine?.backupOriginalSegmentId ||
      (machine?.segmentId && machine.segmentId !== backupSegmentId ? machine.segmentId : "");
    const segmentName =
      machine?.backupRealSegmentName ||
      machine?.backupOriginalSegmentName ||
      (machine?.segmentId && machine.segmentId !== backupSegmentId ? machine.segmentName : "");

    const segment =
      (segmentId &&
        (decoratedSegments.find((item) => item.id === segmentId) ||
          activeSegments.find((item) => item.id === segmentId) ||
          segments.find((item) => item.id === segmentId))) ||
      fallback;

    return {
      segmentId: segment?.id || segmentId || fallback?.id,
      segmentName: segment?.name || segmentName || fallback?.name || "Não organizadas",
      segment
    };
  }

  function getServiceOrderAssetOrigin(machine, order) {
    const record = maintenanceRecords[machine.id];
    const origin = record?.origin || machine.maintenanceOrigin;
    if (
      origin?.segmentId &&
      origin.segmentId !== backupSegmentId &&
      !isMaintenanceSegmentName(origin.segmentName)
    ) {
      return origin;
    }

    if (
      machine.segmentId &&
      machine.segmentId !== backupSegmentId &&
      !isMaintenanceSegmentName(machine.segmentName)
    ) {
      return {
        tabId:
          machine.tabId && machine.tabId !== "global-unorganized" && machine.tabId !== "global-backup"
            ? machine.tabId
            : order?.environmentId || activeInventoryTab.id,
        groupId: getSegmentGroupId(
          decoratedSegments.find((segment) => segment.id === machine.segmentId),
          decoratedSegmentGroups
        ),
        segmentId: machine.segmentId,
        segmentName: machine.segmentName
      };
    }

    const fallback = getDefaultInventorySegment();
    return fallback
      ? {
          tabId: order?.environmentId || activeInventoryTab.id,
          groupId: "",
          segmentId: fallback.id,
          segmentName: fallback.name
        }
      : null;
  }

  async function handleSelectBackupForServiceOrder(order, backupMachine) {
    if (!order || !backupMachine) return false;

    if (!order.assetId) {
      notify("Vincule a máquina principal antes de selecionar um Backup.", "danger");
      return false;
    }

    if (!backupMachine.isBackup) {
      notify("Selecione uma máquina marcada como Backup.", "danger");
      return false;
    }

    if (backupMachine.backupStatus === "in_use") {
      notify("Esta máquina Backup já está em uso em outra OS.", "danger");
      return false;
    }

    const mainMachine = findDecoratedDevice(order.assetId);
    if (!mainMachine) {
      notify("Não foi possível localizar a máquina principal da OS.", "danger");
      return false;
    }

    const targetOrigin = getServiceOrderAssetOrigin(mainMachine, order);
    if (!targetOrigin?.segmentId) {
      notify("Não foi possível localizar o segmento original da máquina principal.", "danger");
      return false;
    }

    const maintenanceReady = await ensureMachineInMaintenanceForServiceOrder(mainMachine, order);
    if (!maintenanceReady) return false;

    const backupOrigin = getRealBackupLocation(backupMachine);
    const targetSegment =
      decoratedSegments.find((segment) => segment.id === targetOrigin.segmentId) ||
      activeSegments.find((segment) => segment.id === targetOrigin.segmentId) ||
      segments.find((segment) => segment.id === targetOrigin.segmentId) ||
      getDefaultInventorySegment();

    if (!targetSegment) {
      notify("Não foi possível localizar o segmento de destino do Backup.", "danger");
      return false;
    }

    const moved = await handleMoveMachine(backupMachine, targetSegment.id, {
      reason: "backup_in_use",
      targetTabId: targetOrigin.tabId || order.environmentId || activeInventoryTab.id,
      forceSingle: true,
      allowBackupMove: true
    });
    if (!moved) return false;

    try {
      const backupResponse = await updateDeviceBackup(token, backupMachine.id, {
        isBackup: true,
        status: "in_use",
        serviceOrderId: order.id,
        originalSegmentId: backupOrigin.segmentId,
        originalSegmentName: backupOrigin.segmentName
      });
      upsertDeviceInState(backupResponse.device);

      const updatedOrder = await handleUpdateServiceOrder(order.id, { backupAssetId: backupMachine.id });
      await addServiceOrderSystemHistory(order.id, {
        eventType: "backup",
        message: "Backup selecionado e movido para o local da máquina principal.",
        oldValue: "",
        newValue: backupMachine.name
      });
      appendDeviceHistoryEvent(mainMachine.id, {
        id: `${mainMachine.id}-backup-replacement-${Date.now()}`,
        createdAt: new Date().toISOString(),
        userName: user.name,
        eventType: "backup",
        message: `Substituída temporariamente por máquina Backup na OS #${order.number}.`,
        oldValue: mainMachine.name,
        newValue: backupMachine.name
      });
      appendDeviceHistoryEvent(backupMachine.id, {
        id: `${backupMachine.id}-backup-in-use-${Date.now()}`,
        createdAt: new Date().toISOString(),
        userName: user.name,
        eventType: "backup",
        message: `Usada como substituta na OS #${order.number}.`,
        oldValue: backupOrigin.segmentName,
        newValue: targetSegment.name
      });
      await loadData(true);
      notify(`${backupMachine.name} alocada como Backup da OS ${updatedOrder?.number || order.number}.`, "ok");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function releaseBackupForServiceOrder(order, options = {}) {
    if (!order?.backupAssetId) return false;

    const backupMachine = findDecoratedDevice(order.backupAssetId);
    if (!backupMachine) {
      await handleUpdateServiceOrder(order.id, { backupAssetId: null });
      return true;
    }

    const backupOrigin = getRealBackupLocation(backupMachine);
    const targetSegment = backupOrigin.segment || getDefaultInventorySegment();

    if (!targetSegment?.id) {
      notify("Não foi possível localizar o retorno do Backup.", "danger");
      return false;
    }

    const moved = backupMachine.segmentId === targetSegment.id
      ? true
      : await handleMoveMachine(backupMachine, targetSegment.id, {
          reason: "backup_return",
          targetTabId: backupMachine.tabId || activeInventoryTab.id,
          forceSingle: true,
          allowBackupMove: true
        });
    if (!moved) return false;

    try {
      const backupResponse = await updateDeviceBackup(token, backupMachine.id, {
        isBackup: true,
        status: "available",
        serviceOrderId: null,
        originalSegmentId: targetSegment.id,
        originalSegmentName: targetSegment.name
      });
      upsertDeviceInState(backupResponse.device);
      await handleUpdateServiceOrder(order.id, { backupAssetId: null });
      await addServiceOrderSystemHistory(order.id, {
        eventType: "backup",
        message: options.finalized
          ? "OS finalizada e máquina Backup devolvida para a área Backup."
          : "Máquina Backup devolvida para a área Backup.",
        oldValue: backupMachine.name,
        newValue: backupSegmentName
      });
      appendDeviceHistoryEvent(backupMachine.id, {
        id: `${backupMachine.id}-backup-return-${Date.now()}`,
        createdAt: new Date().toISOString(),
        userName: user.name,
        eventType: "backup",
        message: `Devolvida para a area Backup pela OS #${order.number}.`,
        oldValue: backupMachine.segmentName,
        newValue: backupSegmentName
      });
      await loadData(true);
      notify(`${backupMachine.name} devolvida para Backup.`, "ok");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function removeMachineFromInventory(machine) {
    if (!machine) return false;

    const confirmed = window.confirm(
      `Remover "${machine.name}" do inventário?\n\nA máquina/ativo deixará de aparecer no inventário. Esta ação deve ser usada apenas quando o equipamento saiu do ambiente monitorado.`
    );
    if (!confirmed) return false;

    try {
      await deleteDevice(token, machine.id);
      setAllDevices((current) => current.filter((device) => device.id !== machine.id));
      setDevices((current) => current.filter((device) => device.id !== machine.id));
      setSelectedDevice((current) => (current?.id === machine.id ? null : current));
      setSelectedAssetIds((current) => {
        const next = new Set(current);
        next.delete(machine.id);
        return next;
      });
      notify(`${machine.name} removida do inventario.`, "ok");
      await loadData(true);
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function handleCreateManualAsset(payload) {
    setManualAssetSaving(true);
    try {
      const response = await createManualAsset(token, payload);
      upsertDeviceInState(response.device);
      updateInventoryMeta("devices", response.device.id, {
        tabId: activeInventoryTab.id,
        order: activeAllDevices.length
      });
      setManualAssetFormOpen(false);
      notify(`Ativo ${response.device.name} criado.`, "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setManualAssetSaving(false);
    }
  }

  async function handleRefreshPing(machine) {
    if (!machine || machine.source !== "manual") return;

    try {
      const response = await refreshAssetPing(token, machine.id);
      upsertDeviceInState(response.device);
      notify(response.ping.message, response.device.status === "online" ? "ok" : "danger");
      await loadData(true);
      return response.device;
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleChangeDeviceType(deviceId, assetType) {
    try {
      const response = await updateDeviceType(token, deviceId, assetType);
      upsertDeviceInState(response.device);
      notify("Tipo do aparelho atualizado.", "ok");
      await loadData(true);
      return response.device;
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  function handleInventoryDragStart(event) {
    if (activeView !== "inventory") return;

    const machineId = event.active?.data?.current?.machineId;
    const segmentId = event.active?.data?.current?.segmentId;
    const activeType = event.active?.data?.current?.type;
    window.dispatchEvent(new CustomEvent("it-guardian:close-popovers"));
    document.body.classList.add("is-inventory-dragging");
    dragStartScrollY.current = window.scrollY;
    sidebarWasCollapsedBeforeDrag.current = sidebarCollapsed;
    window.clearTimeout(sidebarAutoCloseTimer.current);
    setSidebarDragActive(true);
    setSidebarCollapsed(false);
    setActiveDragMachine(activeType === "machine" ? activeAllDevices.find((device) => device.id === machineId) || null : null);
    setActiveDragSegment(activeType === "segment" ? activeSegments.find((segment) => segment.id === segmentId) || null : null);
    if (machineId && !selectedAssetIds.has(machineId)) {
      setSelectedAssetIds(new Set([machineId]));
    }
  }

  function handleInventoryDragCancel({ forceCollapse = false } = {}) {
    document.body.classList.remove("is-inventory-dragging");
    setActiveDragMachine(null);
    setActiveDragSegment(null);
    setSidebarDragActive(false);
    window.clearTimeout(sidebarAutoCloseTimer.current);

    if (forceCollapse) {
      setSidebarHoverOpen(false);
      setSidebarCollapsed(true);
      return;
    }

    if (sidebarWasCollapsedBeforeDrag.current) {
      sidebarAutoCloseTimer.current = window.setTimeout(() => setSidebarCollapsed(true), 950);
    }
  }

  function animateScrollForDrop(result) {
    if (!result?.moved) return;

    const target = document.getElementById(`inventory-segment-${result.targetSegmentId}`);

    if (target) {
      window.setTimeout(() => {
        target.classList.add("drop-confirm-highlight");
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 110);

      window.setTimeout(() => {
        target.classList.remove("drop-confirm-highlight");
      }, 1150);
    }

    window.setTimeout(() => {
      window.scrollTo({ top: dragStartScrollY.current, behavior: "smooth" });
    }, target ? 920 : 260);
  }

  function handleInventoryBoardDragEnd(event) {
    let result = null;
    let droppedViaSidebar = false;
    if (activeView === "inventory") {
      const activeType = event.active?.data?.current?.type;
      const overType = event.over?.data?.current?.type;
      droppedViaSidebar = overType === "sidebar-segment" || overType === "sidebar-segment-group-drop";

      if (activeType === "segment") {
        const segmentId = event.active?.data?.current?.segmentId;
        const groupId = event.over?.data?.current?.groupId;

        if (
          segmentId &&
          (overType === "segment-group-drop" || overType === "sidebar-segment-group-drop") &&
          groupId !== undefined
        ) {
          const segment = activeSegments.find((item) => item.id === segmentId) || segments.find((item) => item.id === segmentId);
          const currentGroupId = getSegmentGroupId(segment, activeSegmentGroups);

          if (segment && !segment.isDefault && currentGroupId !== groupId) {
            moveSegmentToGroup(segmentId, groupId);
            result = { moved: true, targetSegmentId: segmentId };
            notify(
              groupId
                ? `${segment.name} movido para ${activeSegmentGroups.find((group) => group.id === groupId)?.name || "grupo"}.`
                : `${segment.name} movido para Sem grupo.`,
              "ok"
            );
          }
        }
      } else {
        result = handleInventoryDragEnd(event);
      }
    }
    handleInventoryDragCancel({ forceCollapse: droppedViaSidebar });
    animateScrollForDrop(result);
  }

  function openMoveModal(machine, targetSegmentId = machine.segmentId) {
    setMoveModal(machine);
    setMoveTarget(targetSegmentId);
  }

  function saveMachineAlias(machineId, alias) {
    setMachineAliases((current) => {
      const next = { ...current };
      if (alias) {
        next[machineId] = alias;
      } else {
        delete next[machineId];
      }
      localStorage.setItem(aliasKey, JSON.stringify(next));
      return next;
    });
    notify(alias ? "Nome fantasia atualizado." : "Nome fantasia removido.", "ok");
  }

  function addMachineObservation(machineId, text) {
    setMachineObservations((current) => {
      const next = {
        ...current,
        [machineId]: [
          {
            id: `${machineId}-${Date.now()}`,
            createdAt: new Date().toISOString(),
            user: user.name,
            text
          },
          ...(current[machineId] || [])
        ]
      };
      localStorage.setItem(observationsKey, JSON.stringify(next));
      return next;
    });
    notify("Observacao adicionada.", "ok");
  }

  function removeMachinePeripheral(machineId, peripheral) {
    const confirmed = window.confirm(`Remover periferico "${peripheral.type}" deste ativo?`);
    if (!confirmed) return null;

    const removedKey = peripheralKey(peripheral);
    const event = {
      id: `${machineId}-peripheral-removed-${Date.now()}`,
      createdAt: new Date().toISOString(),
      user: user.name,
      change: `Periferico removido: ${peripheral.type}`,
      message: `${peripheral.type} - ${peripheral.brand || "Sem marca"} - ${peripheral.assetTag || "Sem patrimonio"}`,
      field: "peripherals",
      oldValue: `${peripheral.type} ${peripheral.brand || ""} ${peripheral.assetTag || ""}`.trim(),
      newValue: "Removido"
    };

    setRemovedPeripherals((current) => {
      const next = {
        ...current,
        [machineId]: Array.from(new Set([...(current[machineId] || []), removedKey]))
      };
      localStorage.setItem(peripheralRemovalsKey, JSON.stringify(next));
      return next;
    });

    setPeripheralHistory((current) => {
      const next = {
        ...current,
        [machineId]: [event, ...(current[machineId] || [])]
      };
      localStorage.setItem(peripheralHistoryKey, JSON.stringify(next));
      return next;
    });

    const update = (device) =>
      device.id === machineId
        ? {
            ...device,
            assetHistory: [event, ...(device.assetHistory || [])],
            hardware: {
              ...device.hardware,
              peripherals: (device.hardware?.peripherals || []).filter((item) => peripheralKey(item) !== removedKey)
            }
          }
        : device;

    setAllDevices((current) => current.map(update));
    setDevices((current) => current.map(update));
    setSelectedDevice((current) => (current?.id === machineId ? update(current) : current));
    notify("Periferico removido e registrado no historico.", "ok");
    return event;
  }

  function saveSegmentGroups(nextGroups) {
    setSegmentGroups(nextGroups);
  }

  function openSegmentGroupForm() {
    setSegmentGroupForm({ mode: "create", group: null });
  }

  function renameSegmentGroup(groupId) {
    const group = activeSegmentGroups.find((item) => item.id === groupId);
    if (!group) return;
    setSegmentGroupForm({ mode: "edit", group });
  }

  async function submitSegmentGroupForm(name, color) {
    const cleanName = name.trim();
    const nextColor = color || pickUnusedPaletteColor(activeSegmentGroups);
    const duplicate = activeSegmentGroups.some(
      (group) =>
        group.id !== segmentGroupForm?.group?.id &&
        group.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      notify("Ja existe um grupo com esse nome.", "danger");
      return;
    }

    setSegmentGroupSaving(true);
    try {
      if (segmentGroupForm?.mode === "create") {
        const response = await createSegmentGroupApi(token, {
          name: cleanName,
          color: nextColor
        });
        saveSegmentGroups([...segmentGroups, response.group]);
        updateInventoryMeta("groups", response.group.id, {
          tabId: activeInventoryTab.id,
          order: activeSegmentGroups.length
        });
        notify("Grupo criado.", "ok");
      } else if (segmentGroupForm?.group?.id) {
        const response = await updateSegmentGroup(token, segmentGroupForm.group.id, {
          name: cleanName,
          color: nextColor
        });
        saveSegmentGroups(
          segmentGroups.map((item) =>
            item.id === segmentGroupForm.group.id ? { ...item, ...response.group } : item
          )
        );
        notify("Grupo renomeado.", "ok");
      }

      setSegmentGroupForm(null);
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSegmentGroupSaving(false);
    }
  }

  function toggleSegmentGroup(groupId) {
    const group = activeSegmentGroups.find((item) => item.id === groupId);
    if (!group) return;

    const collapsed = !group.collapsed;
    saveSegmentGroups(segmentGroups.map((item) => (item.id === groupId ? { ...item, collapsed } : item)));
    updateSegmentGroup(token, groupId, { collapsed }).catch((error) => notify(error.message, "danger"));
  }

  async function changeSegmentGroupColor(groupId, color) {
    const group = activeSegmentGroups.find((item) => item.id === groupId);
    if (!group || !color || group.color === color) return;

    saveSegmentGroups(segmentGroups.map((item) => (item.id === groupId ? { ...item, color } : item)));

    try {
      const response = await updateSegmentGroup(token, groupId, { color });
      saveSegmentGroups(
        segmentGroups.map((item) =>
          item.id === groupId ? { ...item, ...response.group } : item
        )
      );
    } catch (error) {
      saveSegmentGroups(segmentGroups);
      notify(error.message, "danger");
    }
  }

  async function deleteSegmentGroup(groupId) {
    const group = activeSegmentGroups.find((item) => item.id === groupId);
    if (!group) return;

    const segmentCount = activeSegments.filter((segment) => getSegmentGroupId(segment, activeSegmentGroups) === groupId).length;
    const confirmed = segmentCount
      ? window.confirm(`Excluir o grupo "${group.name}" e mover ${segmentCount} segmento(s) para Sem grupo?`)
      : window.confirm(`Excluir o grupo "${group.name}"?`);

    if (!confirmed) return;

    try {
      await deleteSegmentGroupApi(token, groupId);
      saveSegmentGroups(segmentGroups.filter((item) => item.id !== groupId));
      setSegments((current) =>
        current.map((segment) => (segment.groupId === groupId ? { ...segment, groupId: "" } : segment))
      );

      if (selectedInventoryGroup === groupId) {
        setSelectedInventoryGroup("all");
        setSelectedInventorySegment("all");
      }

      notify("Grupo excluido. Segmentos mantidos em Sem grupo.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  function moveSegmentToGroup(segmentId, groupId) {
    const previousGroups = segmentGroups;
    const nextGroups = assignSegmentToGroup(segmentGroups, segmentId, groupId);
    saveSegmentGroups(nextGroups.map((group) => (group.id === groupId ? { ...group, collapsed: false } : group)));
    const targetGroupId = groupId || "";
    const targetSiblings = activeSegments.filter(
      (segment) => segment.id !== segmentId && getSegmentGroupId(segment, activeSegmentGroups) === targetGroupId
    );
    updateInventoryMeta("segments", segmentId, {
      tabId: activeInventoryTab.id,
      order: targetSiblings.length
    });
    setSegments((current) =>
      current.map((segment) => (segment.id === segmentId ? { ...segment, groupId: groupId || "" } : segment))
    );
    renameSegment(token, segmentId, { groupId: groupId || null }).catch(async (error) => {
      saveSegmentGroups(previousGroups);
      await loadData(true);
      notify(error.message, "danger");
    });
  }

  function handleCreateSegment() {
    const groupId =
      selectedInventoryGroup === "all" || selectedInventoryGroup === "ungrouped"
        ? ""
        : selectedInventoryGroup;
    setSegmentForm({ mode: "create", segment: null, groupId });
  }

  async function submitSegmentForm(name, groupId = "") {
    const cleanName = name.trim();
    const targetGroupId = groupId || "";

    if (isReservedSegmentName(cleanName)) {
      notify("Esse nome e reservado pelo sistema.", "danger");
      return;
    }

    const duplicate = hasDuplicateSegmentName(activeSegments, {
      name: cleanName,
      groupId: targetGroupId,
      excludeId: segmentForm?.segment?.id,
      groups: activeSegmentGroups
    });

    if (duplicate) {
      notify("Ja existe um segmento com esse nome neste grupo.", "danger");
      return;
    }

    setSegmentSaving(true);
    try {
      if (segmentForm?.mode === "rename") {
        const response = await renameSegment(token, segmentForm.segment.id, {
          name: cleanName,
          groupId: targetGroupId || null
        });
        const nextGroups = assignSegmentToGroup(segmentGroups, segmentForm.segment.id, targetGroupId);
        saveSegmentGroups(nextGroups);
        updateInventoryMeta("segments", segmentForm.segment.id, { tabId: activeInventoryTab.id });
        setSegments((current) =>
          current.map((item) =>
            item.id === segmentForm.segment.id
              ? { ...item, name: response.segment.name, groupId: response.segment.groupId || "" }
              : item
          )
        );
        setAllDevices((current) =>
          current.map((device) =>
            device.segmentId === segmentForm.segment.id ? { ...device, segmentName: response.segment.name } : device
          )
        );
        notify("Segmento renomeado.", "ok");
      } else {
        const response = await createSegment(token, {
          name: cleanName,
          color: pickSegmentColor(activeSegments),
          groupId: targetGroupId || null
        });
        const nextSegment = { ...response.segment, groupId: response.segment.groupId || targetGroupId };
        const targetSiblings = activeSegments.filter(
          (segment) => getSegmentGroupId(segment, activeSegmentGroups) === targetGroupId
        );
        setSegments((current) => upsertSegmentList(current, nextSegment));
        updateInventoryMeta("segments", response.segment.id, {
          tabId: activeInventoryTab.id,
          order: targetSiblings.length
        });
        if (targetGroupId) {
          saveSegmentGroups(assignSegmentToGroup(segmentGroups, response.segment.id, targetGroupId));
        }
        notify(`Segmento ${response.segment.name} criado.`, "ok");
      }
      setSegmentForm(null);
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSegmentSaving(false);
    }
  }

  function handleRenameSegment(segment) {
    setSegmentForm({ mode: "rename", segment, groupId: segment.groupId || "" });
  }

  async function handleChangeSegmentColor(segment, color) {
    if (!color || color === segment.color) return;

    setSegments((current) =>
      current.map((item) => (item.id === segment.id ? { ...item, color } : item))
    );

    try {
      const response = await renameSegment(token, segment.id, { color });
      setSegments((current) =>
        current.map((item) => (item.id === segment.id ? { ...item, color: response.segment.color } : item))
      );
      await loadData(true);
    } catch (error) {
      setSegments((current) =>
        current.map((item) => (item.id === segment.id ? { ...item, color: segment.color } : item))
      );
      notify(error.message, "danger");
    }
  }

  async function handleDeleteSegment(segment) {
    const confirmed = window.confirm(
      `Excluir o segmento "${segment.name}"? As máquinas vão voltar para Não organizadas.`
    );
    if (!confirmed) return;

    try {
      const wasMaintenanceSegment = isMaintenanceSegmentName(segment.name);
      const affectedMaintenanceMachines = wasMaintenanceSegment
        ? activeAllDevices.filter((device) => device.segmentId === segment.id)
        : [];
      await deleteSegment(token, segment.id);
      saveSegmentGroups(assignSegmentToGroup(segmentGroups, segment.id, ""));
      setSegments((current) => current.filter((item) => item.id !== segment.id));
      if (wasMaintenanceSegment && affectedMaintenanceMachines.length) {
        saveMaintenanceRecords((current) => {
          const next = { ...current };
          for (const machine of affectedMaintenanceMachines) {
            delete next[machine.id];
          }
          return next;
        });
        const defaultSegment = activeSegments.find((item) => item.isDefault);
        const eventTime = new Date().toISOString();
        for (const machine of affectedMaintenanceMachines) {
          updateDeviceSegmentInState(machine.id, defaultSegment?.id, defaultSegment?.name || "Não organizadas", {
            maintenance: false,
            maintenanceOrigin: null
          });
          appendDeviceHistoryEvent(machine.id, {
            id: `${machine.id}-maintenance-segment-removed-${Date.now()}`,
            createdAt: eventTime,
            userName: user.name,
            eventType: "maintenance",
            message: "Segmento Manutenção removido. Máquina movida para Não organizadas.",
            oldValue: segment.name,
            newValue: defaultSegment?.name || "Não organizadas"
          });
        }
      }
      notify("Segmento excluído. Máquinas movidas para Não organizadas.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  function selectInventoryTab(tabId) {
    if (!inventoryTabs.some((tab) => tab.id === tabId)) return;
    setActiveInventoryTabId(tabId);
  }

  function createInventoryTab() {
    const cleanName = getNextInventoryTabName(inventoryTabs);

    const nextTab = {
      id: `tab-${Date.now()}`,
      name: cleanName,
      color: pickUnusedPaletteColor(inventoryTabs),
      order: inventoryTabs.length
    };

    saveInventoryTabs((current) => [...current, nextTab]);
    setActiveInventoryTabId(nextTab.id);
    notify(`Ambiente ${nextTab.name} criado.`, "ok");
  }

  function renameInventoryTab(tabId) {
    const tab = inventoryTabs.find((item) => item.id === tabId);
    if (!tab) return;
    setInventoryTabForm(tab);
  }

  function submitInventoryTabForm(name) {
    const cleanName = name.trim();
    const tabId = inventoryTabForm?.id;
    if (!cleanName || !tabId) return;
    const duplicate = inventoryTabs.some(
      (item) => item.id !== tabId && item.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      notify("Ja existe uma aba com esse nome.", "danger");
      return;
    }

    saveInventoryTabs((current) =>
      current.map((item) => (item.id === tabId ? { ...item, name: cleanName } : item))
    );
    setInventoryTabForm(null);
    notify("Ambiente renomeado.", "ok");
  }

  function deleteInventoryTab(tabId) {
    if (inventoryTabs.length <= 1) {
      notify("Mantenha pelo menos uma aba no inventario.", "danger");
      return;
    }

    const tab = inventoryTabs.find((item) => item.id === tabId);
    if (!tab) return;
    const remainingTabs = inventoryTabs.filter((item) => item.id !== tabId);
    const fallbackTab = remainingTabs[0] || defaultInventoryTab;
    const confirmed = window.confirm(
      `Excluir a aba "${tab.name}"? Os dados locais dela serao movidos para "${fallbackTab.name}".`
    );
    if (!confirmed) return;

    saveInventoryTabs(remainingTabs.map((item, index) => ({ ...item, order: index })));
    saveInventoryTabMeta((current) => {
      const reassign = (collection) =>
        Object.fromEntries(
          Object.entries(collection || {}).map(([id, meta]) => [
            id,
            meta.tabId === tabId ? { ...meta, tabId: fallbackTab.id } : meta
          ])
        );

      return {
        groups: reassign(current.groups),
        segments: reassign(current.segments),
        devices: reassign(current.devices)
      };
    });
    setActiveInventoryTabId(fallbackTab.id);
    notify("Aba excluida. Dados movidos para outro ambiente.", "ok");
  }

  function changeInventoryTabColor(tabId, color) {
    saveInventoryTabs((current) =>
      current.map((tab) => (tab.id === tabId ? { ...tab, color } : tab))
    );
  }

  function moveGroupOrder(groupId, direction) {
    const orderedIds = activeSegmentGroups.map((group) => group.id);
    const nextIds = moveIdInList(orderedIds, groupId, direction);
    if (nextIds === orderedIds) return;

    saveInventoryTabMeta((current) => ({
      ...current,
      groups: {
        ...(current.groups || {}),
        ...Object.fromEntries(
          nextIds.map((id, index) => [
            id,
            {
              ...(current.groups?.[id] || {}),
              tabId: activeInventoryTab.id,
              order: index
            }
          ])
        )
      }
    }));
  }

  function moveSegmentOrder(segment, direction) {
    const groupId = getSegmentGroupId(segment, activeSegmentGroups);
    const orderedIds = activeSegments
      .filter((item) => !item.isDefault && getSegmentGroupId(item, activeSegmentGroups) === groupId)
      .map((item) => item.id);
    const nextIds = moveIdInList(orderedIds, segment.id, direction);
    if (nextIds === orderedIds) return;

    saveInventoryTabMeta((current) => ({
      ...current,
      segments: {
        ...(current.segments || {}),
        ...Object.fromEntries(
          nextIds.map((id, index) => [
            id,
            {
              ...(current.segments?.[id] || {}),
              tabId: activeInventoryTab.id,
              order: index
            }
          ])
        )
      }
    }));
  }

  function logout() {
    onLogout();
  }

  const activeDragSegmentGroupId = activeDragSegment
    ? getSegmentGroupId(activeDragSegment, activeSegmentGroups)
    : "";
  const activeDragSegmentGroupName = activeDragSegmentGroupId
    ? activeSegmentGroups.find((group) => group.id === activeDragSegmentGroupId)?.name || ""
    : "Sem grupo";
  const activeDragSegmentCount = activeDragSegment
    ? activeAllDevices.filter((device) => device.segmentId === activeDragSegment.id).length
    : 0;
  const sidebarExpanded = !sidebarCollapsed || sidebarHoverOpen || sidebarDragActive;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={inventoryCollisionDetection}
      onDragStart={handleInventoryDragStart}
      onDragEnd={handleInventoryBoardDragEnd}
      onDragCancel={handleInventoryDragCancel}
    >
    <main className={`app-shell ${sidebarExpanded ? "" : "sidebar-collapsed"} ${sidebarDragActive ? "sidebar-drag-active" : ""}`}>
      <aside
        className="sidebar"
        onMouseEnter={() => {
          if (!sidebarDragActive) setSidebarHoverOpen(true);
        }}
        onMouseLeave={() => {
          if (sidebarDragActive) return;
          setSidebarHoverOpen(false);
          setSidebarCollapsed(true);
        }}
      >
        <button
          type="button"
          className="brand-mark compact sidebar-brand-toggle"
          onClick={() => setSidebarCollapsed((current) => !current)}
          title={sidebarExpanded ? "Recolher sidebar" : "Expandir sidebar"}
        >
          <ShieldCheck size={28} />
          <strong>IT Guardian</strong>
          <PanelLeftClose size={16} className="sidebar-collapse-indicator" />
        </button>
        <nav>
          {canViewDashboard && (
            <button className={activeView === "dashboard" ? "nav-active" : ""} onClick={() => setActiveView("dashboard")}>
              <Activity size={18} /> <span className="nav-label">Dashboard</span>
            </button>
          )}
          {(canViewAlerts || canViewScripts) && (
            <button className={activeView === "alerts" ? "nav-active" : ""} onClick={() => setActiveView("alerts")}>
              <AlertTriangle size={18} /> <span className="nav-label">Avisos</span>
            </button>
          )}
          {canViewServiceOrders && (
            <button className={activeView === "service-orders" ? "nav-active" : ""} onClick={() => setActiveView("service-orders")}>
              <ClipboardList size={18} /> <span className="nav-label">Ordens de Serviço</span>
            </button>
          )}
          {canViewInventory && (
            <button className={activeView === "inventory" ? "nav-active" : ""} onClick={() => setActiveView("inventory")}>
              <Database size={18} /> <span className="nav-label">Inventário</span>
            </button>
          )}
          {activeView === "inventory" && sidebarExpanded && (
            <SidebarSegmentFilter
              devices={activeAllDevices}
              segments={activeSegments}
              groups={activeSegmentGroups}
              selectedGroupId={selectedInventoryGroup}
              selectedSegmentId={selectedInventorySegment}
              machineDragActive={Boolean(activeDragMachine)}
              onSelectGroup={selectInventoryGroup}
              onSelectSegment={selectInventorySegment}
              onToggleGroup={toggleSegmentGroup}
            />
          )}
        </nav>
        {canOpenGeneralSettings && (
          <div className="sidebar-footer">
            <button
              type="button"
              className="sidebar-general-settings-button"
              onClick={() => setGeneralSettingsOpen(true)}
              title="Configurações gerais"
            >
              <SettingsIcon size={18} />
              <span className="nav-label">Configurações</span>
            </button>
          </div>
        )}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Infraestrutura em tempo real</h1>
            <p>Ultima atualizacao: {formatTime(lastUpdated)}</p>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => loadData()} title="Atualizar">
              <RefreshCw size={18} />
            </button>
            <button className="icon-button" onClick={onToggleTheme} title={theme === "dark" ? "Modo claro" : "Modo noturno"}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-button" onClick={logout} title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {activeView === "blocked" && <PermissionBlocked />}

        {activeView === "dashboard" && canViewDashboard && (
          <>
            {summary && (
              <section className="summary-grid">
                <SummaryCard icon={Server} label="Dispositivos" value={summary.totalDevices} />
                <SummaryCard icon={ShieldCheck} label="Online" value={summary.online} tone="ok" />
                <SummaryCard icon={WifiOff} label="Erro" value={summary.offline} tone="danger" />
                <SummaryCard icon={AlertTriangle} label="Críticos" value={summary.criticalAlerts} tone="danger" />
              </section>
            )}

            <section className="toolbar">
              <div className="search-box">
                <Search size={18} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, IP ou status" />
              </div>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Todos os status</option>
                <option value="online">Online</option>
                <option value="problem">Problema</option>
                <option value="offline">Erro</option>
              </select>
            </section>

            <section className="content-grid">
              <section className="panel devices-panel">
                <div className="panel-heading">
                  <h2>Máquinas monitoradas</h2>
                  {loading && <span className="loading">Carregando...</span>}
                </div>
                <DeviceTable
                  devices={devices}
                  selectedId={selectedId}
                  onSelect={selectDevice}
                  statusClass={statusClass}
                />
              </section>
              <AlertList alerts={alerts} />
            </section>

            <section className="bottom-grid">
              <DeviceDetails
                device={selectedDevice}
                statusClass={statusClass}
                metricClass={metricClass}
              />
              <section className="panel history-panel">
                <div className="panel-heading">
                  <h2>Histórico de avisos</h2>
                  <Network size={18} />
                </div>
                <div className="chart-box compact-chart">
                  <ResponsiveContainer width="100%" height={170}>
                    <AreaChart data={alertTrend}>
                      <XAxis dataKey="label" stroke="#69758a" />
                      <YAxis allowDecimals={false} stroke="#69758a" />
                      <Tooltip />
                      <Area dataKey="critical" stackId="1" stroke="#d64545" fill="#d64545" />
                      <Area dataKey="warning" stackId="1" stroke="#d6a21f" fill="#d6a21f" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="history-list">
                  {history.map((alert) => (
                    <div key={alert.id}>
                      <span className={`dot ${alert.severity}`} />
                      <strong>{alert.hostName}</strong>
                      <span>{alert.title}{alert.acknowledgement ? " - resolvido" : ""}</span>
                    </div>
                  ))}
                </div>
              </section>
            </section>
          </>
        )}

        {activeView === "alerts" && (canViewAlerts || canViewScripts || canViewPreventivePlans || canViewPreventiveAutomation) && (
          <AlertCenterV2
            token={token}
            alerts={alerts}
            history={history}
            suggestions={serviceOrderSuggestions}
            rules={alertRules}
            scripts={maintenanceScripts}
            preventivePlans={preventivePlans}
            preventiveAutomationPlans={preventiveAutomationPlans}
            preventiveAutomationManagement={preventiveAutomationManagement}
            preventiveAutomationManagementError={preventiveAutomationManagementError}
            preventiveAutomationManagementLoading={loading}
            devices={allDevices}
            segments={decoratedSegments}
            segmentGroups={decoratedSegmentGroups}
            inventoryTabs={inventoryTabs}
            alertPriorityColors={alertPriorityColors}
            alertPrioritySettings={alertPrioritySettings}
            alertCorrelations={alertCorrelations}
            serviceOrders={serviceOrders}
            severityFilter={severityFilter}
            setSeverityFilter={setSeverityFilter}
            statusFilter={alertStatusFilter}
            setStatusFilter={setAlertStatusFilter}
            suggestionStatusFilter={suggestionStatusFilter}
            setSuggestionStatusFilter={setSuggestionStatusFilter}
            canViewAlerts={canViewAlerts}
            canManageSuggestions={canManageAlertSuggestions}
            canConfigureAlerts={canConfigureAlerts}
            canConfigureAlertPrioritySettings={canConfigureAlertPrioritySettings}
            canCommentAlerts={canCommentAlerts}
            canViewScripts={canViewScripts}
            canManageScripts={canManageScripts}
            canRegisterScriptSimulation={canRegisterScriptSimulation}
            canUseScriptsFromAlerts={canUseScriptsFromAlerts}
            canViewScriptLogs={canViewScriptLogs}
            canResolveScriptLogs={canResolveScriptLogs}
            canViewPreventivePlans={canViewPreventivePlans}
            canCreatePreventivePlans={canCreatePreventivePlans}
            canCreatePreventiveServiceOrder={canCreatePreventiveServiceOrder}
            canViewPreventiveAutomation={canViewPreventiveAutomation}
            canCreatePreventiveAutomation={canCreatePreventiveAutomation}
            canUpdatePreventiveAutomation={canUpdatePreventiveAutomation}
            canDisablePreventiveAutomation={canDisablePreventiveAutomation}
            canDeletePreventiveAutomation={canDeletePreventiveAutomation}
            canRemovePreventiveAutomationAsset={canRemovePreventiveAutomationAsset}
            canManagePreventiveAutomationOverride={canManagePreventiveAutomationOverride}
            onEvaluateAlerts={handleEvaluateAlerts}
            onAcceptSuggestion={handleAcceptSuggestion}
            onRejectSuggestion={handleRejectSuggestion}
            onCreatePreventivePlan={handleCreatePreventivePlan}
            onCreatePreventivePlanServiceOrder={handleCreatePreventivePlanServiceOrder}
            onSavePreventiveAutomationPlan={handleSavePreventiveAutomationPlan}
            onDisablePreventiveAutomationPlan={handleDisablePreventiveAutomationPlan}
            onDeletePreventiveAutomationPlan={handleDeletePreventiveAutomationPlan}
            onSavePreventiveAutomationAssetOverride={handleSavePreventiveAutomationAssetOverride}
            onRemovePreventiveAutomationAssetOverride={handleRemovePreventiveAutomationAssetOverride}
            onRemoveAssetFromPreventiveAutomationPlan={handleRemoveAssetFromPreventiveAutomationPlan}
            onRefreshPreventiveAutomationManagement={() => loadData(true)}
            onFetchPreventiveAutomationAsset={handleFetchPreventiveAutomationAsset}
            onOpenServiceOrders={() => setActiveView("service-orders")}
            onUpdateRule={handleUpdateAlertRule}
            onAddAlertComment={handleAddAlertComment}
            onSaveAlertPrioritySettings={handleSaveAlertPrioritySettings}
            onAnalyzeMaintenanceScript={handleAnalyzeMaintenanceScript}
            onSaveMaintenanceScript={handleSaveMaintenanceScript}
            onDeactivateMaintenanceScript={handleDeactivateMaintenanceScript}
            onRegisterMaintenanceScriptSimulation={handleRegisterMaintenanceScriptSimulation}
            onUseSuggestionScript={handleUseSuggestionScript}
            onAcknowledgeScriptLog={handleAcknowledgeScriptLog}
            onApplyScriptLogSuggestedSolution={handleApplyScriptLogSuggestedSolution}
            onCancelScriptValidation={handleCancelScriptValidation}
          />
        )}

        {activeView === "inventory" && canViewInventory && (
          <Suspense fallback={<ViewLoadingState />}>
            <InventoryBoard
            devices={inventoryViewDevices}
            segments={inventoryViewSegments}
            machinesBySegment={machinesBySegment}
            search={inventorySearch}
            setSearch={setInventorySearch}
            selectedGroupId={selectedInventoryGroup}
            selectedSegmentId={selectedInventorySegment}
            selectedAssetIds={selectedAssetIds}
            isBulkSelectionDragging={Boolean(
              sidebarDragActive &&
              activeDragMachine &&
              selectedAssetIds.has(activeDragMachine.id) &&
              selectedAssetIds.size > 1
            )}
            bulkMoveTarget={bulkMoveTarget}
            aliases={machineAliases}
            observations={machineObservations}
            userName={user.name}
            canManage={canManageInventory}
            moveModal={moveModal}
            moveTarget={moveTarget}
            setMoveTarget={setMoveTarget}
            onCreateSegment={handleCreateSegment}
            onRenameSegment={handleRenameSegment}
            onDeleteSegment={handleDeleteSegment}
            onChangeSegmentColor={handleChangeSegmentColor}
            onAliasSave={saveMachineAlias}
            onAddObservation={addMachineObservation}
            onMoveMachine={handleMoveMachine}
            onBulkMoveTargetChange={setBulkMoveTarget}
            onBulkMove={handleBulkMove}
            onBulkPrint={handleBulkPrint}
            onBulkMarkBackup={handleBulkMarkBackup}
            onClearSelection={clearAssetSelection}
            onSelectAsset={handleSelectAsset}
            onToggleSelection={toggleAssetSelection}
            groups={inventoryViewGroups}
            onSelectGroup={selectInventoryGroup}
            onSelectSegment={selectInventorySegment}
            onCreateGroup={openSegmentGroupForm}
            onRenameGroup={renameSegmentGroup}
            onDeleteGroup={deleteSegmentGroup}
            onChangeGroupColor={changeSegmentGroupColor}
            onToggleGroup={toggleSegmentGroup}
            onMoveGroupOrder={moveGroupOrder}
            onMoveSegmentToGroup={moveSegmentToGroup}
            onMoveSegmentOrder={moveSegmentOrder}
            tabs={inventoryTabs}
            activeTab={activeInventoryTab}
            activeTabId={activeInventoryTab.id}
            onSelectTab={selectInventoryTab}
            onCreateTab={createInventoryTab}
            onRenameTab={renameInventoryTab}
            onDeleteTab={deleteInventoryTab}
            onChangeTabColor={changeInventoryTabColor}
            onRemovePeripheral={removeMachinePeripheral}
            onCreateManualAsset={() => setManualAssetFormOpen(true)}
            onRefreshPing={handleRefreshPing}
            onChangeDeviceType={handleChangeDeviceType}
            onPutMaintenance={putMachineInMaintenance}
            onToggleBackup={handleToggleBackup}
            onRemoveMachine={removeMachineFromInventory}
            onCloseMoveModal={() => setMoveModal(null)}
            onOpenMoveModal={openMoveModal}
            />
          </Suspense>
        )}

        {activeView === "service-orders" && canViewServiceOrders && (
          <Suspense fallback={<ViewLoadingState />}>
            <ServiceOrdersBoard
            serviceOrders={serviceOrders}
            devices={decoratedAllDevices}
            segments={decoratedSegments}
            groups={decoratedSegmentGroups}
            tabs={inventoryTabs}
            activeTab={activeInventoryTab}
            token={token}
            notify={notify}
            systemMode={systemMode}
            saving={serviceOrderSaving}
            onCreate={handleCreateServiceOrder}
            onUpdate={handleUpdateServiceOrder}
            onAddHistory={handleAddServiceOrderHistory}
            onStatusChange={handleChangeServiceOrderStatus}
            onDelete={handleDeleteServiceOrder}
            onSelectBackup={handleSelectBackupForServiceOrder}
            onReleaseBackup={releaseBackupForServiceOrder}
            user={user}
            permissions={{
              create: hasPermission(user, "service_orders.create"),
              edit: hasPermission(user, "service_orders.edit"),
              viewAll: hasPermission(user, "service_orders.view_all"),
              changeSector: hasPermission(user, "service_orders.change_sector"),
              changeStatus: hasPermission(user, "service_orders.change_status"),
              finish: hasPermission(user, "service_orders.finish"),
              attendance: hasPermission(user, "service_orders.attendance"),
              parts: hasPermission(user, "service_orders.parts"),
              print: hasPermission(user, "service_orders.print"),
              settings: hasPermission(user, "service_orders.settings")
            }}
            />
          </Suspense>
        )}

      </section>
      <SegmentFormModal
        mode={segmentForm?.mode}
        segment={segmentForm?.segment}
        segments={activeSegments}
        groups={activeSegmentGroups}
        selectedGroupId={segmentForm?.groupId || ""}
        saving={segmentSaving}
        onClose={() => setSegmentForm(null)}
        onSubmit={submitSegmentForm}
      />
      <SegmentGroupFormModal
        mode={segmentGroupForm?.mode}
        group={segmentGroupForm?.group}
        groups={activeSegmentGroups}
        suggestedColor={pickUnusedPaletteColor(activeSegmentGroups)}
        saving={segmentGroupSaving}
        onClose={() => setSegmentGroupForm(null)}
        onSubmit={submitSegmentGroupForm}
      />
      <InventoryTabFormModal
        tab={inventoryTabForm}
        tabs={inventoryTabs}
        onClose={() => setInventoryTabForm(null)}
        onSubmit={submitInventoryTabForm}
      />
      <ManualAssetForm
        open={manualAssetFormOpen}
        saving={manualAssetSaving}
        onClose={() => setManualAssetFormOpen(false)}
        onSubmit={handleCreateManualAsset}
      />
      <GeneralSettingsModal
        open={generalSettingsOpen}
        token={token}
        user={user}
        theme={theme}
        systemMode={systemMode}
        onClose={() => setGeneralSettingsOpen(false)}
        onSystemModeChange={changeSystemMode}
        onToggleTheme={onToggleTheme}
        onLogout={logout}
        notify={notify}
      />
    </main>
    <DragOverlay zIndex={1000} dropAnimation={inventoryDropAnimation} modifiers={[keepDragOverlayNearCursor]}>
      {activeDragMachine ? (
        <AssetDragCompactOverlay
          asset={activeDragMachine}
          segmentColor={activeSegments.find((segment) => segment.id === activeDragMachine?.segmentId)?.color}
          alias={activeDragMachine ? machineAliases[activeDragMachine.id] : ""}
          selected={Boolean(activeDragMachine && selectedAssetIds.has(activeDragMachine.id))}
          selectionCount={activeDragMachine && selectedAssetIds.has(activeDragMachine.id) ? selectedAssetIds.size : 0}
        />
      ) : activeDragSegment ? (
        <SegmentDragOverlay
          segment={activeDragSegment}
          count={activeDragSegmentCount}
          groupName={activeDragSegmentGroupName}
        />
      ) : null}
    </DragOverlay>
    <BulkAssetLabelPrint
      assets={bulkPrintAssets}
      aliases={machineAliases}
      onReadyToPrint={handleBulkPrintReady}
    />
    </DndContext>
  );
}

export default function App() {
  const isPublicSupportPath = ["/abrir-chamado", "/solicitar-suporte"].includes(window.location.pathname);
  const pathAssetId = window.location.pathname.match(/^\/assets\/([^/]+)/)?.[1];
  const assetId = pathAssetId
    ? decodeURIComponent(pathAssetId)
    : new URLSearchParams(window.location.search).get("asset");
  const {
    authLoading,
    clearToast,
    handleAuth,
    logout,
    notify,
    theme,
    toast,
    token,
    toggleTheme,
    user
  } = useAppSessionController({ isPublicSupportPath, assetId });

  if (isPublicSupportPath) {
    return <PublicSupportRequest />;
  }

  if (assetId) {
    return <AssetPublicView assetId={assetId} />;
  }

  if (authLoading) {
    return <ViewLoadingState />;
  }

  if (!token || !user) {
    return (
      <>
        <AuthScreen
          notify={notify}
          onAuth={handleAuth}
        />
        <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
      </>
    );
  }

  return (
    <>
      <Dashboard
        token={token}
        user={user}
        theme={theme}
        notify={notify}
        onToggleTheme={toggleTheme}
        onLogout={logout}
      />
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </>
  );
}
