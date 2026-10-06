import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, vi } from "vitest";
import App from "../App.jsx";

// Dados e montagem do App completo (api.js mockada pelo teste chamador com vi.mock("../api.js"))
// usados pelos testes de acessibilidade/teclado: as visoes reais com dados suficientes para
// exercitar cards, listas, tabelas e modais.

const now = new Date().toISOString();

export const a11yDevices = [
  { id: "d1", name: "PC-01", ip: "10.0.0.1", status: "online", segmentId: "s1", segmentName: "Redes", source: "agent", hardware: {}, assetHistory: [], metrics: { cpu: 40, ram: 55, disk: 70 } },
  { id: "d2", name: "Notebook", ip: "10.0.0.2", status: "offline", segmentId: "s1", segmentName: "Redes", source: "manual", hardware: {}, assetHistory: [], manualAsset: { brand: "Dell", model: "X", assetTag: "123" } }
];

export const a11yServiceOrders = [
  { id: "os-1", number: "OS-001", title: "Trocar memória", status: "open", priority: "high", priorityLabel: "Alta", assetId: "d1", assetName: "PC-01", createdAt: now, description: "Falha na memória", history: [], assignedTechnicianNames: ["Bruno"] },
  { id: "os-2", number: "OS-002", title: "Formatar", status: "in_progress", priority: "low", priorityLabel: "Baixa", assetId: "d2", assetName: "Notebook", createdAt: now, description: "Lento", history: [] }
];

const startToday = new Date();
startToday.setHours(10, 0, 0, 0);
const calendarEvents = [
  { id: "ev-1", title: "Visita urgente", eventType: "technical_visit", status: "scheduled", priority: "urgent", startAt: startToday.toISOString(), endAt: new Date(startToday.getTime() + 3600000).toISOString() },
  { id: "ev-2", title: "Manutenção preventiva", eventType: "preventive", status: "scheduled", priority: "normal", startAt: startToday.toISOString(), endAt: new Date(startToday.getTime() + 7200000).toISOString() }
];

const parts = [
  { id: "p1", name: "SSD NVMe", category: "Armazenamento", inventoryState: "available", discrepancyStatus: "ok", quantity: 3, minimumStock: 1, unit: "un", stockStatus: "ok" },
  { id: "p2", name: "Ryzen 5", category: "Processador", inventoryState: "in_use", sourceAssetId: "d1", discrepancyStatus: "ok", quantity: 1, unit: "un", stockStatus: "ok" }
];

// Dashboard com widgets reais (cartoes, listas, graficos) para o axe e o contraste cobrirem a tela cheia.
const dashboardWidgets = [
  ["status_overview", "l", "m"],
  ["asset_availability", "m", "s"],
  ["current_problems", "m", "s"],
  ["top_assets_cpu", "m", "s"],
  ["alerts_by_severity", "m", "s"],
  ["service_orders_by_status", "m", "s"],
  ["service_orders_sla", "m", "s"],
  ["recent_events", "l", "m"],
  ["critical_assets", "m", "s"]
].map(([type, w, h], index) => ({ id: `w${index}`, type, x: 0, y: index, w, h, refreshIntervalSeconds: 60, config: {} }));

const widgetPreviews = {
  status_overview: { totalAssets: 2, onlineAssets: 1, offlineAssets: 1, criticalAssets: 0, openServiceOrders: 2, overdueServiceOrders: 0, criticalAlerts: 1, health: { score: 82, classification: "attention", classificationLabel: "Atenção" } },
  asset_availability: { total: 2, byStatus: { online: 1, offline: 1 } },
  current_problems: { rows: [{ id: "p1", hostName: "PC-01", severity: "critical", severityLabel: "Crítica", typeLabel: "CPU alta", lastSeenAt: new Date().toISOString() }] },
  top_assets_cpu: { metric: "cpu", rows: [{ id: "d1", name: "PC-01", value: 40 }] },
  alerts_by_severity: { rows: [{ severity: "critical", label: "Crítica", count: 1 }, { severity: "warning", label: "Atenção", count: 2 }] },
  service_orders_by_status: { rows: [{ status: "open", label: "Aberta", count: 1 }, { status: "in_progress", label: "Em atendimento", count: 1 }] },
  service_orders_sla: { openCount: 2, overdueCount: 1, nearDueCount: 1, averageResolutionMinutes: 90, averageFirstResponseMinutes: 15 },
  recent_events: { rows: [{ id: "e1", message: "OS-001 aberta", userName: "Ana", createdAt: new Date().toISOString() }] },
  critical_assets: { rows: [{ id: "d2", name: "Notebook", status: "offline" }] }
};

const alerts = [
  { id: "al1", status: "active", severity: "critical", type: "cpu_high", metric: "cpu", value: 95, threshold: 90, hostName: "PC-01", assetId: "d1", title: "CPU acima do limite em PC-01", occurrencesCount: 3 }
];

const suggestions = [
  { id: "sug1", status: "pending", suggestedPriority: "high", assetId: "d1", alertId: "al1", alertType: "cpu_high", alertMetric: "cpu", title: "Verificação preventiva: CPU acima do limite em PC-01", hostName: "PC-01", occurrencesCount: 3, createdAt: now, updatedAt: now }
];

// jsdom nao tem ResizeObserver (usado pelo ResponsiveContainer dos graficos do dashboard).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

export function setupA11yApiMocks(api, { user = { id: "u1", name: "Ana", email: "ana@empresa.com", role: "admin" } } = {}) {
  vi.clearAllMocks();
  localStorage.clear();
  globalThis.ResizeObserver ||= ResizeObserverStub;
  for (const fn of Object.values(api)) {
    if (typeof fn?.mockResolvedValue === "function") fn.mockResolvedValue({});
  }
  api.fetchAuthSession.mockResolvedValue({ token: "tok", user });
  api.createMonitoringSocket.mockReturnValue(null);
  api.fetchDevices.mockResolvedValue({ devices: a11yDevices, summary: { total: 2, online: 1, offline: 1 } });
  api.fetchSegments.mockResolvedValue({ segments: [{ id: "s1", name: "Redes", color: "#2563eb" }] });
  api.fetchSegmentGroups.mockResolvedValue({ groups: [] });
  api.fetchAlerts.mockResolvedValue({ alerts });
  api.fetchAlertHistory.mockResolvedValue({ alerts });
  api.fetchAlertCorrelations.mockResolvedValue({ correlations: [] });
  api.fetchAlertRules.mockResolvedValue({ rules: [] });
  api.fetchServiceOrderSuggestions.mockResolvedValue({ suggestions });
  api.fetchMaintenanceScripts.mockResolvedValue({ scripts: [] });
  api.fetchPreventivePlans.mockResolvedValue({ preventivePlans: [] });
  api.fetchPreventiveAutomationPlans.mockResolvedValue({ preventiveAutomationPlans: [] });
  api.fetchPreventiveAutomationManagement.mockResolvedValue({ plans: [], machines: [], metadata: {} });
  api.fetchServiceOrders.mockResolvedValue({ serviceOrders: a11yServiceOrders });
  api.fetchAlertSettings.mockResolvedValue({ settings: {} });
  api.fetchSystemSettings.mockResolvedValue({ settings: { systemMode: "local" } });
  api.fetchUserPreference.mockResolvedValue({ value: null });
  api.saveUserPreference.mockResolvedValue({});
  api.fetchDevice.mockResolvedValue({ device: a11yDevices[0] });
  api.fetchDashboardLayout.mockResolvedValue({ widgets: dashboardWidgets });
  api.fetchDashboardWidgetCatalog.mockResolvedValue({ widgets: [
    { type: "asset_availability", label: "Disponibilidade de Ativos", category: "assets", defaultSize: { w: "m", h: "s" } },
    { type: "recent_events", label: "Últimos Eventos Técnicos", category: "events", defaultSize: { w: "l", h: "m" } }
  ] });
  api.previewDashboardWidget.mockImplementation(async (_token, { type }) => ({ type, data: widgetPreviews[type] || {} }));
  api.fetchCalendarEvents.mockResolvedValue({ events: calendarEvents });
  api.fetchCalendarSummary.mockResolvedValue({ summary: { today: 2, overdue: 0, busyTechnicians: 1, scheduledServiceOrders: 1, preventives: 1 } });
  api.fetchTechnicians.mockResolvedValue({ technicians: [{ id: "t1", name: "Bruno" }] });
  api.fetchPartsInventory.mockResolvedValue({ parts });
  api.fetchPartCategories.mockResolvedValue({ categories: [{ id: "c1", name: "Armazenamento", color: "#2563eb" }] });
  api.syncPartsFromAssets.mockResolvedValue({ summary: { created: 0, discrepancies: 0 } });
}

export function renderA11yApp(path) {
  // StrictMode como em main.jsx.
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </StrictMode>
  );
}

// Espera o shell autenticado e os chunks lazy da visao terminarem de carregar.
export async function waitForAppReady(marker) {
  await screen.findByRole("heading", { level: 1 }, { timeout: 8000 });
  await waitFor(() => expect(document.querySelector(".view-loading-state")).toBeNull(), { timeout: 8000 });
  if (marker) await screen.findAllByText(marker, {}, { timeout: 8000 });
  // deixa efeitos assentarem (dados mockados resolvem em microtasks)
  await new Promise((resolve) => setTimeout(resolve, 250));
}
