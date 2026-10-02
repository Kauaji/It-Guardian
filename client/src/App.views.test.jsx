import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api.js";
import App from "./App.jsx";

vi.mock("./api.js");

// Contrato entre o App e cada visao: os testes capturam as props que os
// componentes de dominio recebem e comparam com a lista do App original
// (antes do refactor), garantindo que nada deixou de ser repassado.
const { captured, captureStub } = vi.hoisted(() => {
  const captured = {};
  return {
    captured,
    captureStub: (name, { render = false } = {}) => async () => {
      const { createElement } = await import("react");
      return {
        default: (props) => {
          captured[name] = props;
          return createElement(
            "div",
            { "data-testid": name },
            ...(render ? [props.floorPlansView, props.topologyView] : [])
          );
        }
      };
    }
  };
});

vi.mock("./components/dashboard/widgets/DashboardWorkspace.jsx", captureStub("DashboardWorkspace"));
vi.mock("./components/inventory/InventoryBoard.jsx", captureStub("InventoryBoard", { render: true }));
vi.mock("./components/floorPlans/FloorPlansModule.jsx", captureStub("FloorPlansModule"));
vi.mock("./components/inventory/topology/InventoryNetworkTopologyView.jsx", captureStub("InventoryNetworkTopologyView"));
vi.mock("./components/serviceOrders/ServiceOrdersBoard.jsx", captureStub("ServiceOrdersBoard"));
vi.mock("./components/calendar/TechnicalCalendarPage.jsx", captureStub("TechnicalCalendarPage"));
vi.mock("./components/partsInventory/PartsInventoryPage.jsx", captureStub("PartsInventoryPage"));
vi.mock("./components/alerts/AlertCenterV2.jsx", async () => {
  const { createElement } = await import("react");
  const { useAlertCenterData } = await import("./context/AlertCenterContext.jsx");
  return {
    default: function AlertCenterStub(props) {
      captured.AlertCenterV2 = props;
      captured.alertCenterValue = useAlertCenterData();
      return createElement("div", { "data-testid": "AlertCenterV2" });
    }
  };
});

const keysOf = (value) => Object.keys(value).sort();

// Todo callback (on*/set*) precisa ser funcao e nenhuma prop pode chegar
// undefined: protege contra nomes trocados entre as fatias do workspace.
function expectWired(props) {
  const undefinedKeys = Object.entries(props).filter(([, value]) => value === undefined).map(([key]) => key);
  expect(undefinedKeys).toEqual([]);
  const notFunctions = Object.entries(props)
    .filter(([key, value]) => /^(on[A-Z]|set[A-Z])/.test(key) && typeof value !== "function")
    .map(([key]) => key);
  expect(notFunctions).toEqual([]);
}

const oldProps = {
  InventoryBoard: ["activeTab", "activeTabId", "aliases", "bulkMoveTarget", "canManage", "devices", "floorPlansView", "groups", "isBulkSelectionDragging", "machinesBySegment", "moveModal", "moveTarget", "notify", "observations", "onAddObservation", "onAddPeripheral", "onAliasSave", "onBulkMarkBackup", "onBulkMove", "onBulkMoveTargetChange", "onBulkPrint", "onChangeDeviceType", "onChangeGroupColor", "onChangeSegmentColor", "onChangeTabColor", "onClearSelection", "onCloseMoveModal", "onCreateGroup", "onCreateManualAsset", "onCreateSegment", "onCreateTab", "onDeleteGroup", "onDeleteSegment", "onDeleteTab", "onMoveGroupOrder", "onMoveMachine", "onMoveSegmentOrder", "onMoveSegmentToGroup", "onOpenMoveModal", "onPutMaintenance", "onRefreshPing", "onRemoveMachine", "onRemovePeripheral", "onRenameGroup", "onRenameSegment", "onRenameTab", "onSelectAsset", "onSelectGroup", "onSelectSegment", "onSelectTab", "onToggleBackup", "onToggleGroup", "onToggleSelection", "search", "segments", "selectedAssetIds", "selectedGroupId", "selectedSegmentId", "setMoveTarget", "setSearch", "tabs", "token", "topologyView", "user", "userName"],
  ServiceOrdersBoard: ["activeTab", "devices", "groups", "notify", "onAddHistory", "onCreate", "onDelete", "onOpenCalendar", "onReleaseBackup", "onReopen", "onSelectBackup", "onStatusChange", "onUpdate", "permissions", "remoteScriptExecutionEnabled", "saving", "segments", "serviceOrders", "systemMode", "tabs", "token", "user"],
  TechnicalCalendarPage: ["devices", "focusServiceOrder", "groups", "notify", "onFocusHandled", "permissions", "segments", "serviceOrders", "tabs", "token"],
  PartsInventoryPage: ["devices", "groups", "notify", "onOpenAsset", "permissions", "segments", "serviceOrders", "tabs", "token"],
  AlertCenterV2: ["devices", "inventoryTabs", "onOpenServiceOrders", "remoteScriptExecutionEnabled", "segmentGroups", "segments", "serviceOrders", "token"],
  FloorPlansModule: ["activeTab", "devices", "groups", "notify", "permissions", "segments", "token"],
  InventoryNetworkTopologyView: ["activeTab", "devices", "groups", "notify", "onSelectTab", "segments", "tabs", "token"],
  DashboardWorkspace: ["canCustomize", "notify", "token"],
  alertCenterValue: [
    "alertCorrelations", "alertPriorityColors", "alertPrioritySettings", "alerts", "history",
    "onAcceptSuggestion", "onAddAlertComment", "onAnalyzeMaintenanceScript", "onApplyScriptLogSuggestedSolution",
    "onCancelScriptValidation", "onCreatePreventivePlan", "onCreatePreventivePlanServiceOrder",
    "onDeactivateMaintenanceScript", "onDeletePreventiveAutomationPlan", "onDisablePreventiveAutomationPlan",
    "onEvaluateAlerts", "onFetchPreventiveAutomationAsset", "onReactivatePreventiveAutomationPlan",
    "onRefreshPreventiveAutomationManagement", "onRegisterMaintenanceScriptSimulation",
    "onRejectSuggestion", "onRemoveAssetFromPreventiveAutomationPlan", "onRemovePreventiveAutomationAssetOverride",
    "onSaveAlertPrioritySettings", "onSaveMaintenanceScript", "onSavePreventiveAutomationAssetOverride",
    "onSavePreventiveAutomationPlan", "onUpdateRule", "onAcknowledgeScriptLog", "onUseSuggestionScript",
    "preventiveAutomationManagement", "preventiveAutomationManagementError", "preventiveAutomationManagementLoading",
    "preventiveAutomationPlans", "preventivePlans", "rules", "scripts", "setSeverityFilter", "setStatusFilter",
    "setSuggestionStatusFilter", "severityFilter", "statusFilter", "suggestions", "suggestionStatusFilter"
  ]
};

const permissionKeys = {
  calendar: ["assignTechnician", "cancel", "create", "delete", "update", "viewAllTechnicians"],
  parts: ["assignAssets", "create", "importInvoice", "manageCategories", "moveStock", "reconcileHardware", "update"],
  serviceOrders: ["attendance", "changeSector", "changeStatus", "create", "edit", "finish", "manageChecklists", "parts", "print", "registerSimulation", "reopen", "runScripts", "schedule", "settings", "viewAll"],
  floorPlans: ["create", "delete", "linkInventory", "update", "uploadBackground", "viewHeatmaps"]
};

let location;
function Probe() {
  location = useLocation();
  return null;
}

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Probe />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(captured)) delete captured[key];
  localStorage.clear();
  api.fetchAuthSession.mockResolvedValue({ token: "tok", user: { id: "u1", name: "Ana", role: "admin" } });
  api.createMonitoringSocket.mockReturnValue(null);
  api.fetchDevices.mockResolvedValue({ devices: [{ id: "d1", name: "PC-01", segmentId: "s1", segmentName: "Redes" }], summary: null });
  api.fetchSegments.mockResolvedValue({ segments: [{ id: "s1", name: "Redes" }] });
  api.fetchSegmentGroups.mockResolvedValue({ groups: [] });
  api.fetchAlerts.mockResolvedValue({ alerts: [] });
  api.fetchAlertHistory.mockResolvedValue({ alerts: [] });
  api.fetchAlertCorrelations.mockResolvedValue({ correlations: [] });
  api.fetchAlertRules.mockResolvedValue({ rules: [] });
  api.fetchServiceOrderSuggestions.mockResolvedValue({ suggestions: [] });
  api.fetchMaintenanceScripts.mockResolvedValue({ scripts: [] });
  api.fetchPreventivePlans.mockResolvedValue({ preventivePlans: [] });
  api.fetchPreventiveAutomationPlans.mockResolvedValue({ preventiveAutomationPlans: [] });
  api.fetchPreventiveAutomationManagement.mockResolvedValue({ plans: [], machines: [], metadata: {} });
  api.fetchServiceOrders.mockResolvedValue({ serviceOrders: [{ id: "os-1", number: 1 }] });
  api.fetchAlertSettings.mockResolvedValue({ settings: {} });
  api.fetchSystemSettings.mockResolvedValue({ settings: { systemMode: "local" } });
  api.fetchUserPreference.mockResolvedValue({ value: null });
  api.saveUserPreference.mockResolvedValue({});
  api.fetchDevice.mockResolvedValue({ device: null });
});

describe("contrato das visoes com os componentes de dominio", () => {
  it("Dashboard recebe token, notify e permissao de personalizar", async () => {
    renderApp("/");
    await screen.findByTestId("DashboardWorkspace");
    expect(keysOf(captured.DashboardWorkspace)).toEqual(oldProps.DashboardWorkspace);
    expectWired(captured.DashboardWorkspace);
    expect(captured.DashboardWorkspace).toMatchObject({ token: "tok", canCustomize: true });
  });

  it("Inventario repassa exatamente as props do App original, inclusive plantas e mapa de rede", async () => {
    renderApp("/inventario");
    await screen.findByTestId("InventoryBoard");
    expect(keysOf(captured.InventoryBoard)).toEqual(oldProps.InventoryBoard);
    expectWired(captured.InventoryBoard);
    expect(captured.InventoryBoard).toMatchObject({
      token: "tok",
      userName: "Ana",
      canManage: true,
      search: "",
      selectedGroupId: "all",
      selectedSegmentId: "all",
      isBulkSelectionDragging: false
    });
    expect(captured.InventoryBoard.selectedAssetIds).toBeInstanceOf(Set);
    expect(captured.InventoryBoard.devices.map((device) => device.id)).toEqual(["d1"]);

    await screen.findByTestId("FloorPlansModule");
    await screen.findByTestId("InventoryNetworkTopologyView");
    expect(keysOf(captured.FloorPlansModule)).toEqual(oldProps.FloorPlansModule);
    expectWired(captured.FloorPlansModule);
    expectWired(captured.InventoryNetworkTopologyView);
    expect(keysOf(captured.FloorPlansModule.permissions)).toEqual(permissionKeys.floorPlans);
    expect(keysOf(captured.InventoryNetworkTopologyView)).toEqual(oldProps.InventoryNetworkTopologyView);
  });

  it("Inventario sem permissao de plantas e mapa nao monta essas abas", async () => {
    api.fetchAuthSession.mockResolvedValue({
      token: "tok",
      user: { id: "u2", name: "Beto", role: "viewer", effectivePermissions: ["inventory.view"] }
    });
    renderApp("/plantas");
    await screen.findByTestId("InventoryBoard");
    expect(captured.InventoryBoard.floorPlansView).toBeNull();
    expect(captured.InventoryBoard.topologyView).toBeNull();
    expect(captured.InventoryBoard.canManage).toBe(false);
  });

  it("Ordens de Servico, Agenda e Pecas recebem as props e permissoes originais", async () => {
    const first = renderApp("/ordens-de-servico");
    await screen.findByTestId("ServiceOrdersBoard");
    expect(keysOf(captured.ServiceOrdersBoard)).toEqual(oldProps.ServiceOrdersBoard);
    expectWired(captured.ServiceOrdersBoard);
    expect(keysOf(captured.ServiceOrdersBoard.permissions)).toEqual(permissionKeys.serviceOrders);
    expect(captured.ServiceOrdersBoard).toMatchObject({ systemMode: "local", saving: false });
    first.unmount();

    const second = renderApp("/agenda");
    await screen.findByTestId("TechnicalCalendarPage");
    expect(keysOf(captured.TechnicalCalendarPage)).toEqual(oldProps.TechnicalCalendarPage);
    expectWired({ ...captured.TechnicalCalendarPage, focusServiceOrder: null });
    expect(keysOf(captured.TechnicalCalendarPage.permissions)).toEqual(permissionKeys.calendar);
    second.unmount();

    renderApp("/pecas");
    await screen.findByTestId("PartsInventoryPage");
    expect(keysOf(captured.PartsInventoryPage)).toEqual(oldProps.PartsInventoryPage);
    expectWired(captured.PartsInventoryPage);
    expect(keysOf(captured.PartsInventoryPage.permissions)).toEqual(permissionKeys.parts);
  });

  it("Avisos recebe as props de AlertCenterV2 e o contrato completo do AlertCenterProvider", async () => {
    renderApp("/avisos");
    await screen.findByTestId("AlertCenterV2");
    expect(keysOf(captured.AlertCenterV2)).toEqual(oldProps.AlertCenterV2);
    expectWired(captured.AlertCenterV2);
    expectWired(captured.alertCenterValue);
    expect(keysOf(captured.alertCenterValue)).toEqual([...oldProps.alertCenterValue].sort());
    expect(captured.alertCenterValue.severityFilter).toBe("all");
  });
});

describe("navegacao originada pelas visoes", () => {
  it("Avisos -> Ordens de Servico", async () => {
    renderApp("/avisos");
    await screen.findByTestId("AlertCenterV2");
    act(() => captured.AlertCenterV2.onOpenServiceOrders());
    await screen.findByTestId("ServiceOrdersBoard");
    expect(location.pathname).toBe("/ordens-de-servico");
  });

  it("Ordens de Servico -> Agenda com foco na OS ao criar evento, e sem foco caso contrario", async () => {
    renderApp("/ordens-de-servico");
    await screen.findByTestId("ServiceOrdersBoard");
    const order = { id: "os-1", number: 1 };

    act(() => captured.ServiceOrdersBoard.onOpenCalendar(order, true));
    await screen.findByTestId("TechnicalCalendarPage");
    expect(location.pathname).toBe("/agenda");
    expect(captured.TechnicalCalendarPage.focusServiceOrder).toBe(order);

    act(() => captured.TechnicalCalendarPage.onFocusHandled());
    await waitFor(() => expect(captured.TechnicalCalendarPage.focusServiceOrder).toBeNull());
  });

  it("Pecas -> Inventario abrindo o ativo (evento open-inventory-board com assetId)", async () => {
    const listener = vi.fn();
    window.addEventListener("it-guardian:open-inventory-board", listener);
    renderApp("/pecas");
    await screen.findByTestId("PartsInventoryPage");

    act(() => captured.PartsInventoryPage.onOpenAsset("d1"));
    await screen.findByTestId("InventoryBoard");
    expect(location.pathname).toBe("/inventario");
    await waitFor(() => expect(listener).toHaveBeenCalled());
    expect(listener.mock.calls.at(-1)[0].detail).toEqual({ assetId: "d1" });
    window.removeEventListener("it-guardian:open-inventory-board", listener);
  });

  it("o botao Inventario de Ativos dispara o evento que volta o quadro para a aba inicial", async () => {
    const listener = vi.fn();
    window.addEventListener("it-guardian:open-inventory-board", listener);
    renderApp("/");
    await screen.findByTestId("DashboardWorkspace");
    act(() => screen.getByRole("button", { name: "Inventário de Ativos" }).click());
    await screen.findByTestId("InventoryBoard");
    await waitFor(() => expect(listener).toHaveBeenCalledTimes(2));
    window.removeEventListener("it-guardian:open-inventory-board", listener);
  });
});
