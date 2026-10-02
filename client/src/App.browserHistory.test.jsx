import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api.js";
import App from "./App.jsx";

vi.mock("./api.js");

const { stub } = vi.hoisted(() => ({
  stub: (testId) => async () => {
    const { createElement } = await import("react");
    return { default: () => createElement("div", { "data-testid": testId }) };
  }
}));
vi.mock("./components/dashboard/widgets/DashboardWorkspace.jsx", stub("view-dashboard"));
vi.mock("./components/inventory/InventoryBoard.jsx", stub("view-inventory"));
vi.mock("./components/alerts/AlertCenterV2.jsx", stub("view-alerts"));

// Usa o BrowserRouter real (History API do jsdom) para validar a convivencia
// com o modulo de plantas, que troca a URL direto com window.history.
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.history.replaceState(null, "", "/inventario");
  api.fetchAuthSession.mockResolvedValue({ token: "tok", user: { id: "u1", name: "Ana", role: "admin" } });
  api.createMonitoringSocket.mockReturnValue(null);
  api.fetchDevices.mockResolvedValue({ devices: [], summary: null });
  api.fetchSegments.mockResolvedValue({ segments: [] });
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
  api.fetchDevice.mockResolvedValue({ device: null });
});

describe("History API real", () => {
  it("voltar/avancar do navegador troca de visao mesmo apos o modulo de plantas reescrever a URL", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    await screen.findByTestId("view-inventory");

    // O FloorPlansModule faz isso diretamente (history.replaceState com state nulo).
    act(() => window.history.replaceState(null, "", "/plantas/p1/editor"));

    await user.click(screen.getByRole("button", { name: /Avisos/ }));
    await screen.findByTestId("view-alerts");
    expect(window.location.pathname).toBe("/avisos");

    await user.click(screen.getByRole("button", { name: "Dashboard" }));
    await screen.findByTestId("view-dashboard");
    expect(window.location.pathname).toBe("/");

    act(() => window.history.back());
    await screen.findByTestId("view-alerts");
    expect(window.location.pathname).toBe("/avisos");

    act(() => window.history.back());
    await screen.findByTestId("view-inventory");
    expect(window.location.pathname).toBe("/plantas/p1/editor");

    act(() => window.history.forward());
    await screen.findByTestId("view-alerts");
  });

  it("carrega direto numa URL profunda de plantas ja logado", async () => {
    window.history.replaceState(null, "", "/plantas/abc/editor");
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    await screen.findByTestId("view-inventory");
    expect(window.location.pathname).toBe("/plantas/abc/editor");
  });

  it("deslogado e redirecionado para /login e volta ao destino apos entrar", async () => {
    api.fetchAuthSession.mockRejectedValue(new Error("401"));
    api.login.mockResolvedValue({ token: "tok", user: { id: "u1", name: "Ana", role: "admin" } });
    window.history.replaceState(null, "", "/avisos");
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    const submit = await screen.findByRole("button", { name: "Acessar painel" });
    expect(window.location.pathname).toBe("/login");

    await user.click(submit);
    await screen.findByTestId("view-alerts");
    await waitFor(() => expect(window.location.pathname).toBe("/avisos"));
  });
});
