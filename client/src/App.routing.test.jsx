import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api.js";
import App from "./App.jsx";

vi.mock("./api.js");

// As visoes pesadas viram stubs que identificam a tela.
const { stub, stubWithProp } = vi.hoisted(() => ({
  stub: (testId, text) => async () => {
    const { createElement } = await import("react");
    return { default: () => createElement("div", { "data-testid": testId }, text) };
  },
  stubWithProp: (testId, label, prop) => async () => {
    const { createElement } = await import("react");
    return { default: (props) => createElement("div", { "data-testid": testId }, `${label} ${props[prop]}`) };
  }
}));
vi.mock("./components/dashboard/widgets/DashboardWorkspace.jsx", stub("view-dashboard", "Dashboard configuravel"));
vi.mock("./components/alerts/AlertCenterV2.jsx", stub("view-alerts", "Central de avisos"));
vi.mock("./components/inventory/InventoryBoard.jsx", stub("view-inventory", "Quadro do inventario"));
vi.mock("./components/serviceOrders/ServiceOrdersBoard.jsx", stub("view-service-orders", "Quadro de OS"));
vi.mock("./components/calendar/TechnicalCalendarPage.jsx", stub("view-calendar", "Agenda"));
vi.mock("./components/partsInventory/PartsInventoryPage.jsx", stub("view-parts", "Pecas"));
vi.mock("./components/public/PublicSupportRequest.jsx", stub("public-support", "Formulario publico"));
vi.mock("./components/inventory/AssetPublicView.jsx", stubWithProp("public-asset", "Ficha", "assetId"));
vi.mock("./components/public/PublicServiceOrderTracking.jsx", stubWithProp("public-tracking", "Acompanhamento", "token"));

const admin = { id: "u1", name: "Ana Admin", role: "admin" };
const limited = (...permissions) => ({ id: "u2", name: "Beto", role: "viewer", effectivePermissions: permissions });

let router;
function RouterProbe() {
  router = { location: useLocation(), navigate: useNavigate() };
  return null;
}

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <RouterProbe />
    </MemoryRouter>
  );
}

function mockServer({ user = admin } = {}) {
  if (user) {
    api.fetchAuthSession.mockResolvedValue({ token: "tok", user });
  } else {
    api.fetchAuthSession.mockRejectedValue(new Error("401"));
  }
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
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockServer();
});

describe("roteamento: usuario deslogado", () => {
  it("vai para /login e, apos entrar, volta ao destino pedido", async () => {
    mockServer({ user: null });
    api.login.mockResolvedValue({ token: "tok", user: admin });
    const user = userEvent.setup();
    renderApp("/ordens-de-servico");

    await user.click(await screen.findByRole("button", { name: "Acessar painel" }));
    expect(router.location.pathname).toBe("/login");

    mockServer({ user: admin });
    await screen.findByTestId("view-service-orders");
    expect(router.location.pathname).toBe("/ordens-de-servico");
    expect(screen.getByRole("heading", { name: "Infraestrutura em tempo real" })).toBeInTheDocument();
  });

  it("preserva busca e hash do destino pedido", async () => {
    mockServer({ user: null });
    api.login.mockResolvedValue({ token: "tok", user: admin });
    const user = userEvent.setup();
    renderApp("/agenda?dia=2026-10-01#manha");

    await user.click(await screen.findByRole("button", { name: "Acessar painel" }));
    await screen.findByTestId("view-calendar");
    expect(router.location.pathname + router.location.search + router.location.hash).toBe("/agenda?dia=2026-10-01#manha");
  });

  it("entra no dashboard quando nao havia destino especifico", async () => {
    mockServer({ user: null });
    api.login.mockResolvedValue({ token: "tok", user: admin });
    const user = userEvent.setup();
    renderApp("/");
    await user.click(await screen.findByRole("button", { name: "Acessar painel" }));
    await screen.findByTestId("view-dashboard");
    expect(router.location.pathname).toBe("/");
  });

  it("mostra o carregamento enquanto a sessao e verificada, sem redirecionar antes", async () => {
    let rejectSession;
    api.fetchAuthSession.mockReturnValue(new Promise((_resolve, reject) => { rejectSession = reject; }));
    renderApp("/pecas");
    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
    expect(router.location.pathname).toBe("/pecas");

    await act(async () => rejectSession(new Error("401")));
    await screen.findByRole("button", { name: "Acessar painel" });
    expect(router.location.pathname).toBe("/login");
  });

  it("usuario ja logado em /login volta ao dashboard", async () => {
    renderApp("/login");
    await screen.findByTestId("view-dashboard");
    expect(router.location.pathname).toBe("/");
  });
});

describe("roteamento: app autenticado", () => {
  it("abre cada visao pela sua URL em portugues", async () => {
    const cases = [
      ["/", "view-dashboard"],
      ["/avisos", "view-alerts"],
      ["/ordens-de-servico", "view-service-orders"],
      ["/agenda", "view-calendar"],
      ["/pecas", "view-parts"],
      ["/inventario", "view-inventory"],
      ["/plantas", "view-inventory"],
      ["/plantas/p1/editor", "view-inventory"]
    ];
    for (const [path, testId] of cases) {
      const { unmount } = renderApp(path);
      expect(await screen.findByTestId(testId), path).toBeInTheDocument();
      expect(router.location.pathname).toBe(path);
      unmount();
    }
  });

  it("rota desconhecida cai no dashboard", async () => {
    renderApp("/rota-que-nao-existe");
    await screen.findByTestId("view-dashboard");
    expect(router.location.pathname).toBe("/");
  });

  it("navega entre visoes pelos botoes da sidebar e o voltar do navegador funciona", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await screen.findByTestId("view-dashboard");

    await user.click(screen.getByRole("button", { name: /Avisos/ }));
    await screen.findByTestId("view-alerts");
    expect(router.location.pathname).toBe("/avisos");

    await user.click(screen.getByRole("button", { name: /Ordens de Servi/ }));
    await screen.findByTestId("view-service-orders");
    expect(router.location.pathname).toBe("/ordens-de-servico");

    await user.click(screen.getByRole("button", { name: "Agenda Técnica" }));
    await screen.findByTestId("view-calendar");

    await user.click(screen.getByRole("button", { name: "Inventário de Peças" }));
    await screen.findByTestId("view-parts");

    await user.click(screen.getByRole("button", { name: "Inventário de Ativos" }));
    await screen.findByTestId("view-inventory");
    expect(router.location.pathname).toBe("/inventario");

    act(() => router.navigate(-1));
    await screen.findByTestId("view-parts");
    expect(router.location.pathname).toBe("/pecas");

    act(() => router.navigate(-2));
    await screen.findByTestId("view-service-orders");
    act(() => router.navigate(1));
    await screen.findByTestId("view-calendar");
  });

  it("marca como ativo o item da visao atual", async () => {
    renderApp("/avisos");
    await screen.findByTestId("view-alerts");
    expect(screen.getByRole("button", { name: /Avisos/ })).toHaveClass("nav-active");
    expect(screen.getByRole("button", { name: /Dashboard/ })).not.toHaveClass("nav-active");
  });

  it("clicar na visao atual nao empilha entradas no historico", async () => {
    const user = userEvent.setup();
    renderApp("/avisos");
    await screen.findByTestId("view-alerts");
    const before = window.history.length;
    await user.click(screen.getByRole("button", { name: /Avisos/ }));
    expect(router.location.pathname).toBe("/avisos");
    expect(window.history.length).toBe(before);
  });

  it("mantem os nomes acessiveis usados pelos testes e2e", async () => {
    renderApp("/");
    await screen.findByTestId("view-dashboard");
    for (const name of ["Dashboard", "Avisos", "Ordens de Serviço", "Agenda Técnica", "Inventário de Peças", "Inventário de Ativos"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Configurações" })).toBeInTheDocument();
    expect(screen.getByTitle("Atualizar")).toBeInTheDocument();
    expect(screen.getByTitle("Sair")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Infraestrutura em tempo real" })).toBeInTheDocument();
  });

  it("redireciona para a primeira visao permitida e esconde os itens sem permissao", async () => {
    mockServer({ user: limited("calendar.view", "parts_inventory.view") });
    renderApp("/");
    await screen.findByTestId("view-calendar");
    expect(router.location.pathname).toBe("/agenda");
    expect(screen.queryByRole("button", { name: /Dashboard/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ordens de Servi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configurações" })).not.toBeInTheDocument();
  });

  it("nao exibe visao sem permissao nem ao digitar a URL", async () => {
    mockServer({ user: limited("dashboard.view") });
    renderApp("/ordens-de-servico");
    await screen.findByTestId("view-dashboard");
    expect(screen.queryByTestId("view-service-orders")).not.toBeInTheDocument();
    expect(router.location.pathname).toBe("/");
  });

  it("mostra o aviso de permissao quando o usuario nao tem nenhuma visao", async () => {
    mockServer({ user: limited() });
    renderApp("/avisos");
    expect(await screen.findByText("Você não possui permissão para acessar este módulo.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Infraestrutura em tempo real" })).toBeInTheDocument();
  });

  it("sair encerra a sessao e leva para /login sem destino guardado", async () => {
    const user = userEvent.setup();
    renderApp("/avisos");
    await screen.findByTestId("view-alerts");

    await user.click(screen.getByTitle("Sair"));
    await screen.findByRole("button", { name: "Acessar painel" });
    expect(router.location.pathname).toBe("/login");
    expect(router.location.state?.from).toBeUndefined();
    expect(api.logoutSession).toHaveBeenCalledWith("tok");
  });

  it("sessao expirada volta ao login guardando a tela atual", async () => {
    renderApp("/pecas");
    await screen.findByTestId("view-parts");

    act(() => window.dispatchEvent(new Event("it-guardian:auth-expired")));
    await screen.findByRole("button", { name: "Acessar painel" });
    expect(router.location.pathname).toBe("/login");
    expect(router.location.state.from.pathname).toBe("/pecas");
    expect(await screen.findByText("Sessao expirada. Faca login novamente.")).toBeInTheDocument();
  });

  it("carrega os dados ao abrir e permite atualizar pelo botao da topbar", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await screen.findByTestId("view-dashboard");
    await waitFor(() => expect(api.fetchServiceOrders).toHaveBeenCalled());
    const calls = api.fetchServiceOrders.mock.calls.length;
    await user.click(screen.getByTitle("Atualizar"));
    await waitFor(() => expect(api.fetchServiceOrders.mock.calls.length).toBeGreaterThan(calls));
  });

  it("alterna o tema pela topbar", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await screen.findByTestId("view-dashboard");
    await user.click(screen.getByTitle("Modo noturno"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByTitle("Modo claro")).toBeInTheDocument();
  });

  it("abre as configuracoes gerais por modal, sem mudar a URL", async () => {
    const user = userEvent.setup();
    api.fetchSectors.mockResolvedValue({ sectors: [] });
    api.fetchUsers.mockResolvedValue({ users: [] });
    api.fetchPermissions.mockResolvedValue({ permissions: [] });
    renderApp("/avisos");
    await screen.findByTestId("view-alerts");
    await user.click(screen.getByRole("button", { name: "Configurações" }));
    expect(router.location.pathname).toBe("/avisos");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("roteamento: paginas publicas", () => {
  it("formulario publico de chamado nao exige login nem consulta a sessao", async () => {
    mockServer({ user: null });
    for (const path of ["/abrir-chamado", "/solicitar-suporte"]) {
      const { unmount } = renderApp(path);
      expect(await screen.findByTestId("public-support")).toBeInTheDocument();
      expect(router.location.pathname).toBe(path);
      unmount();
    }
    expect(api.fetchAuthSession).not.toHaveBeenCalled();
  });

  it("acompanhamento por token recebe o token decodificado", async () => {
    mockServer({ user: null });
    renderApp("/chamado/abc%20123");
    const tracking = await screen.findByTestId("public-tracking");
    expect(within(tracking).getByText("Acompanhamento abc 123")).toBeInTheDocument();
    expect(api.fetchAuthSession).not.toHaveBeenCalled();
  });

  it("ficha publica de ativo por caminho e por query string", async () => {
    mockServer({ user: null });
    const first = renderApp("/assets/maq-1");
    expect(await screen.findByText("Ficha maq-1")).toBeInTheDocument();
    first.unmount();

    renderApp("/?asset=maq-2");
    expect(await screen.findByText("Ficha maq-2")).toBeInTheDocument();
    expect(api.fetchAuthSession).not.toHaveBeenCalled();
  });
});
