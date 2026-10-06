import { render } from "@testing-library/react";
import { vi } from "vitest";
import { AppSessionProvider } from "../../../context/AppSessionContext.jsx";
import { AlertCenterProvider } from "../../../context/AlertCenterContext.jsx";
import { defaultPriorityColors, normalizePrioritySettings } from "../alertUtils.js";

// Fixtures e helpers compartilhados pelos testes da Central de Avisos.
// Os testes usam apenas nomes acessiveis e textos visiveis para continuarem
// validos independentemente de como os componentes sao divididos.

export const adminUser = { id: "u-admin", role: "admin" };

export function restrictedUser(permissions) {
  return { id: "u-restricted", role: "viewer", effectivePermissions: permissions };
}

export function freshAgentDevice(overrides = {}) {
  return {
    id: "d1",
    name: "PC-01",
    ip: "10.0.0.1",
    segmentId: "s1",
    status: "online",
    statusLabel: "Online",
    type: "Desktop",
    source: "agent",
    agent: { lastSeenAt: new Date().toISOString() },
    ...overrides
  };
}

export const baseDevices = [
  freshAgentDevice(),
  { id: "d2", name: "PC-02", ip: "10.0.0.2", segmentId: "s1", status: "online", statusLabel: "Online", type: "Desktop" },
  {
    id: "d3",
    name: "Servidor-01",
    ip: "10.0.0.3",
    segmentId: "s2",
    status: "offline",
    statusLabel: "Offline",
    type: "Servidor",
    isBackup: true
  }
];

export const baseSegments = [
  { id: "s1", name: "Recepção", groupId: "g1" },
  { id: "s2", name: "Servidores", groupId: "g1" }
];

export const baseSegmentGroups = [{ id: "g1", name: "Matriz", tabId: "t1" }];
export const baseInventoryTabs = [{ id: "t1", name: "Ambiente 1" }];

export const baseSuggestions = [
  {
    id: "sug1",
    status: "pending",
    suggestedPriority: "high",
    assetId: "d1",
    alertId: "al1",
    alertType: "cpu_high",
    alertMetric: "cpu",
    alertValue: 95,
    alertThreshold: 90,
    title: "Verificação preventiva: CPU acima do limite em PC-01",
    hostName: "PC-01",
    occurrencesCount: 3,
    createdAt: "2026-05-10T10:00:00.000Z",
    updatedAt: "2026-05-11T10:00:00.000Z"
  },
  {
    id: "sug2",
    status: "pending",
    suggestedPriority: "medium",
    assetId: "d2",
    alertId: "al2",
    alertType: "ram_high",
    alertMetric: "ram",
    alertValue: 88,
    alertThreshold: 85,
    title: "Verificação preventiva: RAM acima do limite em PC-02",
    hostName: "PC-02",
    occurrencesCount: 1,
    createdAt: "2026-05-09T10:00:00.000Z",
    updatedAt: "2026-05-09T10:00:00.000Z"
  },
  {
    id: "sug3",
    status: "accepted",
    suggestedPriority: "low",
    assetId: "d3",
    createdServiceOrderId: "OS-77",
    alertType: "disk_high",
    title: "Verificação preventiva: Disco acima do limite em Servidor-01",
    hostName: "Servidor-01",
    createdAt: "2026-05-01T10:00:00.000Z"
  },
  {
    id: "sug4",
    status: "rejected",
    suggestedPriority: "low",
    assetId: "d3",
    rejectionReason: "Falso positivo",
    alertType: "temperature_high",
    title: "Verificação preventiva: Temperatura alta em Servidor-01",
    hostName: "Servidor-01",
    createdAt: "2026-05-02T10:00:00.000Z"
  }
];

export const baseAlerts = [
  {
    id: "al1",
    status: "active",
    severity: "critical",
    type: "cpu_high",
    metric: "cpu",
    value: 95,
    threshold: 90,
    hostName: "PC-01",
    assetId: "d1",
    title: "CPU acima do limite em PC-01",
    occurrencesCount: 3
  },
  {
    id: "al2",
    status: "active",
    severity: "warning",
    type: "ram_high",
    metric: "ram",
    value: 88,
    threshold: 85,
    hostName: "PC-02",
    assetId: "d2",
    title: "RAM acima do limite em PC-02",
    occurrencesCount: 1
  }
];

export const baseHistory = [
  ...baseAlerts,
  {
    id: "al3",
    status: "resolved",
    severity: "warning",
    type: "disk_high",
    metric: "disk",
    value: 91,
    threshold: 90,
    hostName: "Servidor-01",
    assetId: "d3",
    title: "Disco acima do limite em Servidor-01",
    updatedAt: "2026-05-03T10:00:00.000Z"
  }
];

export const baseRules = [
  {
    id: "r-cpu",
    type: "cpu_high",
    threshold: 90,
    durationMinutes: 10,
    recurrenceCount: 3,
    recurrenceWindow: "same_day",
    suggestedPriority: "high",
    enabled: true
  },
  {
    id: "r-off",
    type: "machine_offline",
    threshold: null,
    durationMinutes: 0,
    recurrenceCount: 2,
    recurrenceWindow: "last_24h",
    suggestedPriority: "critical",
    enabled: false
  }
];

export const baseScripts = [
  {
    id: "sc1",
    name: "Limpar temporários",
    category: "Limpeza",
    riskLevel: "low",
    active: true,
    description: "Remove arquivos temporários."
  },
  { id: "sc2", name: "Reiniciar spooler", category: "Impressão", riskLevel: "high", active: true },
  { id: "sc3", name: "Script antigo", category: "Legado", riskLevel: "low", active: false }
];

export function buildCenterValue(overrides = {}) {
  return {
    alerts: baseAlerts,
    history: baseHistory,
    suggestions: baseSuggestions,
    rules: baseRules,
    scripts: baseScripts,
    preventivePlans: [],
    preventiveAutomationPlans: [],
    preventiveAutomationManagement: { plans: [], machines: [], metadata: { planCount: 0, machineCount: 0 } },
    preventiveAutomationManagementError: "",
    preventiveAutomationManagementLoading: false,
    alertPriorityColors: defaultPriorityColors,
    alertPrioritySettings: normalizePrioritySettings(),
    alertCorrelations: [],
    severityFilter: "all",
    setSeverityFilter: vi.fn(),
    statusFilter: "all",
    setStatusFilter: vi.fn(),
    suggestionStatusFilter: "all",
    setSuggestionStatusFilter: vi.fn(),
    onEvaluateAlerts: vi.fn(),
    onAcceptSuggestion: vi.fn().mockResolvedValue(undefined),
    onRejectSuggestion: vi.fn().mockResolvedValue(undefined),
    onCreatePreventivePlan: vi
      .fn()
      .mockResolvedValue({ id: "pp1", name: "Plano preventivo", assets: [{}], scripts: [{}, {}], createdAt: "2026-06-01T10:00:00.000Z" }),
    onCreatePreventivePlanServiceOrder: vi
      .fn()
      .mockResolvedValue({ preventivePlan: { id: "pp1", name: "Plano preventivo", serviceOrderId: "OS-9", assets: [], scripts: [] } }),
    onSavePreventiveAutomationPlan: vi.fn().mockResolvedValue(undefined),
    onDisablePreventiveAutomationPlan: vi.fn().mockResolvedValue(undefined),
    onReactivatePreventiveAutomationPlan: vi.fn().mockResolvedValue(undefined),
    onDeletePreventiveAutomationPlan: vi.fn().mockResolvedValue(undefined),
    onSavePreventiveAutomationAssetOverride: vi.fn(),
    onRemovePreventiveAutomationAssetOverride: vi.fn(),
    onRemoveAssetFromPreventiveAutomationPlan: vi.fn(),
    onRefreshPreventiveAutomationManagement: vi.fn(),
    onFetchPreventiveAutomationAsset: vi.fn(),
    onUpdateRule: vi.fn(),
    onAddAlertComment: vi.fn().mockResolvedValue(undefined),
    onSaveAlertPrioritySettings: vi.fn().mockImplementation(async (settings) => settings),
    onAnalyzeMaintenanceScript: vi.fn(),
    onSaveMaintenanceScript: vi.fn(),
    onDeactivateMaintenanceScript: vi.fn(),
    onRegisterMaintenanceScriptSimulation: vi.fn(),
    onUseSuggestionScript: vi.fn().mockResolvedValue(undefined),
    onAcknowledgeScriptLog: vi.fn().mockResolvedValue(undefined),
    onApplyScriptLogSuggestedSolution: vi.fn().mockResolvedValue(undefined),
    onCancelScriptValidation: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

export function renderWithAlertCenter(ui, { user = adminUser, center = {} } = {}) {
  const value = buildCenterValue(center);
  const tree = (element, centerValue) => (
    <AppSessionProvider value={{ user }}>
      <AlertCenterProvider value={centerValue}>{element}</AlertCenterProvider>
    </AppSessionProvider>
  );
  const result = render(tree(ui, value));
  // Reexecuta a arvore com novos valores de contexto (simula o App atualizando os dados).
  const rerenderWithCenter = (nextCenter = {}) => {
    const nextValue = { ...value, ...nextCenter };
    result.rerender(tree(ui, nextValue));
    return nextValue;
  };
  return { ...result, center: value, rerenderWithCenter };
}

export const loggedValidationWithLog = {
  id: "val1",
  status: "observed_persistent",
  scriptName: "Limpar temporários",
  finishedAt: "2026-05-12T10:00:00.000Z",
  log: {
    id: "log1",
    attentionRequired: true,
    acknowledgedAt: null,
    parsedSummary: "Falha ao limpar pasta.",
    errorDetected: true,
    errorType: "permission",
    errorCategory: "Acesso",
    errorSeverity: "alta",
    probableCause: "Pasta em uso.",
    suggestedSolution: "Fechar o processo e repetir.",
    rawLog: "ERRO: acesso negado"
  }
};
