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

const alerts = [
  { id: "al1", status: "active", severity: "critical", type: "cpu_high", metric: "cpu", value: 95, threshold: 90, hostName: "PC-01", assetId: "d1", title: "CPU acima do limite em PC-01", occurrencesCount: 3 }
];

const suggestions = [
  { id: "sug1", status: "pending", suggestedPriority: "high", assetId: "d1", alertId: "al1", alertType: "cpu_high", alertMetric: "cpu", title: "Verificação preventiva: CPU acima do limite em PC-01", hostName: "PC-01", occurrencesCount: 3, createdAt: now, updatedAt: now }
];

export function setupA11yApiMocks(api, { user = { id: "u1", name: "Ana", email: "ana@empresa.com", role: "admin" } } = {}) {
  vi.clearAllMocks();
  localStorage.clear();
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
