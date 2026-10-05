import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api.js";
import * as identity from "./api/identityApi.js";
import App from "./App.jsx";

vi.mock("./api.js");
vi.mock("./api/identityApi.js");

const { stub } = vi.hoisted(() => ({
  stub: (testId) => async () => {
    const { createElement } = await import("react");
    return { default: () => createElement("div", { "data-testid": testId }) };
  }
}));
vi.mock("./components/dashboard/widgets/DashboardWorkspace.jsx", stub("view-dashboard"));
vi.mock("./components/alerts/AlertCenterV2.jsx", stub("view-alerts"));

const admin = { id: "u1", name: "Ana", email: "ana@empresa.com", role: "admin", isAdmin: true, mfaEnabled: true, mustChangePassword: false };
let path;

function Probe() {
  path = useLocation().pathname;
  return null;
}

function renderApp(initial) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <App />
      <Probe />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.logoutSession.mockResolvedValue({});
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
  identity.fetchSessions.mockResolvedValue([]);
  identity.fetchMfaStatus.mockResolvedValue({ enabled: true, requiredForAdmins: false, recoveryCodesLeft: 3 });
});

describe("identidade no app", () => {
  it("troca obrigatoria bloqueia o app: sem navegacao e sem carregar dados ate trocar", async () => {
    api.fetchAuthSession.mockResolvedValue({ token: "tok", user: { ...admin, mustChangePassword: true } });
    identity.changePassword.mockResolvedValue({ token: "tok2", user: admin });
    const user = userEvent.setup();
    renderApp("/avisos");

    expect(await screen.findByRole("heading", { name: "Troque a senha para continuar" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByTestId("view-alerts")).not.toBeInTheDocument();
    expect(api.fetchDevices).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Senha atual"), "temporaria-123");
    await user.type(screen.getByLabelText("Nova senha"), "cavalo azul come batata");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "cavalo azul come batata");
    await user.click(screen.getByRole("button", { name: "Trocar senha e continuar" }));

    expect(await screen.findByTestId("view-alerts")).toBeInTheDocument();
    expect(path).toBe("/avisos");
  });

  it("menu do usuario leva a /conta/seguranca, sem depender de permissao", async () => {
    api.fetchAuthSession.mockResolvedValue({ token: "tok", user: { ...admin, role: "viewer", isAdmin: false, effectivePermissions: [] } });
    const user = userEvent.setup();
    renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Minha conta" }));
    await user.click(screen.getByRole("menuitem", { name: /Segurança da conta/ }));

    expect(await screen.findByRole("heading", { name: "Segurança da conta" })).toBeInTheDocument();
    expect(path).toBe("/conta/seguranca");
    await waitFor(() => expect(identity.fetchSessions).toHaveBeenCalledWith("tok"));
  });

  it("abre /conta/seguranca direto pela URL", async () => {
    api.fetchAuthSession.mockResolvedValue({ token: "tok", user: admin });
    renderApp("/conta/seguranca");
    expect(await screen.findByRole("heading", { name: "Segurança da conta" })).toBeInTheDocument();
    expect(path).toBe("/conta/seguranca");
  });

  it("deslogado em /conta/seguranca vai ao login e volta depois de entrar", async () => {
    api.fetchAuthSession.mockRejectedValue(new Error("401"));
    identity.login.mockResolvedValue({ token: "tok", user: admin });
    const user = userEvent.setup();
    renderApp("/conta/seguranca");

    await user.click(await screen.findByRole("button", { name: "Acessar painel" }));
    api.fetchAuthSession.mockResolvedValue({ token: "tok", user: admin });
    expect(await screen.findByRole("heading", { name: "Segurança da conta" })).toBeInTheDocument();
    expect(path).toBe("/conta/seguranca");
  });

  it("sessao expirada avisa 'Sua sessao expirou' uma vez e ignora 401 atrasado depois de sair", async () => {
    api.fetchAuthSession.mockResolvedValue({ token: "tok", user: admin });
    renderApp("/");
    await screen.findByTestId("view-dashboard");

    act(() => window.dispatchEvent(new Event("it-guardian:auth-expired")));
    expect(await screen.findByText("Sua sessão expirou. Entre novamente.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Acessar painel" })).toBeInTheDocument();
    expect(path).toBe("/login");
  });

  it("401 atrasado chegando ja no login nao mostra aviso de sessao expirada", async () => {
    api.fetchAuthSession.mockRejectedValue(new Error("401"));
    renderApp("/");
    await screen.findByRole("button", { name: "Acessar painel" });
    act(() => window.dispatchEvent(new Event("it-guardian:auth-expired")));
    expect(screen.queryByText("Sua sessão expirou. Entre novamente.")).not.toBeInTheDocument();
  });
});
