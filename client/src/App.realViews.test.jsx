import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api.js";
import App from "./App.jsx";

vi.mock("./api.js");

// Smoke test com os componentes de dominio REAIS (sem stubs): garante que as
// props montadas pelas visoes bastam para renderizar sem erro.
const devices = [
  { id: "d1", name: "PC-01", status: "online", segmentId: "s1", segmentName: "Redes", source: "agent", hardware: {}, assetHistory: [] },
  { id: "d2", name: "Notebook", status: "offline", segmentId: "s1", segmentName: "Redes", source: "manual", hardware: {}, assetHistory: [] }
];

function renderApp(path) {
  // StrictMode como em main.jsx: efeitos e renders duplicados nao podem quebrar nada.
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </StrictMode>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Defaults: toda chamada nao especificada abaixo responde com objeto vazio.
  for (const fn of Object.values(api)) {
    if (typeof fn?.mockResolvedValue === "function") fn.mockResolvedValue({});
  }
  api.fetchAuthSession.mockResolvedValue({ token: "tok", user: { id: "u1", name: "Ana", role: "admin" } });
  api.createMonitoringSocket.mockReturnValue(null);
  api.fetchDevices.mockResolvedValue({ devices, summary: { total: 2, online: 1, offline: 1 } });
  api.fetchSegments.mockResolvedValue({ segments: [{ id: "s1", name: "Redes", color: "#2563eb" }] });
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
  api.fetchServiceOrders.mockResolvedValue({ serviceOrders: [] });
  api.fetchAlertSettings.mockResolvedValue({ settings: {} });
  api.fetchSystemSettings.mockResolvedValue({ settings: { systemMode: "local" } });
  api.fetchUserPreference.mockResolvedValue({ value: null });
  api.saveUserPreference.mockResolvedValue({});
  api.fetchDevice.mockResolvedValue({ device: devices[0] });
});

describe("App com visoes reais", () => {
  it("renderiza o quadro de inventario com os ativos e segmentos", async () => {
    renderApp("/inventario");
    expect(await screen.findByText("PC-01", {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getAllByText("Redes").length).toBeGreaterThan(0);
  });

  it("navega por todas as visoes reais sem derrubar o app", async () => {
    const user = userEvent.setup();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    renderApp("/");
    await screen.findByRole("heading", { name: "Infraestrutura em tempo real" });

    for (const name of ["Avisos", "Ordens de Serviço", "Agenda Técnica", "Inventário de Peças", "Inventário de Ativos", "Dashboard"]) {
      await user.click(screen.getByRole("button", { name }));
      // espera os chunks lazy carregarem (fallback de Suspense some) antes de checar erros
      await waitFor(() => expect(document.querySelector(".view-loading-state")).toBeNull(), { timeout: 8000 });
      expect(screen.queryByText(/Não foi possível abrir/), name).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Não foi possível abrir/)).not.toBeInTheDocument();
    errors.mockRestore();
  }, 30000);
});
