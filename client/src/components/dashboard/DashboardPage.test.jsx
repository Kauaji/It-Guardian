import { cloneElement } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api.js", () => ({ fetchDashboardSummary: vi.fn() }));
// jsdom nao mede layout: o container responsivo passa dimensoes fixas ao grafico
vi.mock("recharts", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    ResponsiveContainer: ({ children }) => cloneElement(children, { width: 400, height: 200 })
  };
});

import { fetchDashboardSummary } from "../../api.js";
import DashboardPage from "./DashboardPage.jsx";

const fullReport = {
  overview: {
    openServiceOrders: 7,
    overdueServiceOrdersAvailable: true,
    overdueServiceOrders: 2,
    inMaintenanceAssets: 3,
    resolvedAlertsToday: 5,
    infrastructureHealth: { score: 82, classification: "healthy", classificationLabel: "Saudável", deductions: [{ reason: "Alertas críticos", points: 5 }] }
  },
  assets: {
    byStatus: [{ label: "Online", count: 4 }, { label: "Offline", count: 1 }],
    mostProblematic: [{ assetId: "a1", name: "SRV-01", occurrences: 6, alertCount: 2 }],
    notSeenRecently: [{ assetId: "a2", name: "PC-09", statusLabel: "Offline", segmentName: "" }]
  },
  alerts: {
    bySeverity: [{ label: "Crítico", count: 2 }],
    trend: [{ date: "2026-10-01", count: 2 }],
    topRecurringAssets: [{ assetId: "a1", name: "SRV-01", occurrences: 9 }]
  },
  serviceOrders: {
    byStatus: [{ label: "Aberta", count: 3 }],
    byPriority: [{ label: "Alta", count: 1 }],
    trend: [{ date: "2026-10-02", count: 1 }],
    oldestOpen: [{ id: "o1", number: "OS-1", title: "Trocar HD", createdAt: "2026-09-01T12:00:00Z" }],
    byTechnician: [{ key: "t1", label: "Carlos", count: 4 }]
  },
  business: {
    enabled: true,
    clientsWithMostAlertsAvailable: false,
    byEnvironment: [{ key: "e1", label: "Matriz", count: 5 }]
  }
};

const devices = [
  { id: "d1", name: "SRV-01", ip: "10.0.0.1", status: "online", statusLabel: "Online", metrics: { cpu: 40, ram: 50, disk: 60 }, hardware: { model: "Dell R740" } }
];

function baseProps(overrides = {}) {
  return {
    token: "tok",
    notify: vi.fn(),
    summary: { totalDevices: 5, online: 4, offline: 1, problem: 0, criticalAlerts: 2 },
    search: "",
    setSearch: vi.fn(),
    status: "",
    setStatus: vi.fn(),
    loading: false,
    devices,
    selectedId: "d1",
    selectedDevice: null,
    selectDevice: vi.fn(),
    alerts: [],
    history: [
      { id: "h1", severity: "critical", hostName: "SRV-01", title: "CPU alta", acknowledgement: { by: "x" } },
      { id: "h2", severity: "warning", title: "Disco" }
    ],
    onNavigateInventory: vi.fn(),
    onNavigateAlerts: vi.fn(),
    onNavigateServiceOrders: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides
  };
}

async function reportLoaded() {
  await screen.findByText("Matriz");
}

beforeEach(() => {
  fetchDashboardSummary.mockResolvedValue(fullReport);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("DashboardPage", () => {
  it("renderiza KPIs, instrumentos, graficos, rankings e visao business com o relatorio", async () => {
    render(<DashboardPage {...baseProps()} />);
    await reportLoaded();
    expect(screen.getByText("Ordens de serviço ainda não finalizadas")).toBeInTheDocument();
    const kpis = Array.from(document.querySelectorAll(".dashboard-kpi-strip-value .sr-only")).map((n) => n.textContent);
    expect(kpis).toEqual(["7", "2", "3", "5"]);
    expect(screen.getByText("Saudável")).toBeInTheDocument();
    expect(screen.getByText("Alertas críticos")).toBeInTheDocument();
    expect(screen.getByText("Dell R740")).toBeInTheDocument();
    expect(fetchDashboardSummary).toHaveBeenCalledWith("tok", { period: "30d" });
    expect(screen.getByText("Alertas resolvidos hoje")).toBeInTheDocument();
    expect(screen.getByText("Ativos monitorados")).toBeInTheDocument();
    expect(screen.getByText("Dispositivos")).toBeInTheDocument();
    expect(screen.getByText("Máquinas monitoradas")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Distribuição e tendências" })).toBeInTheDocument();
    expect(screen.getByText("Ativos por status")).toBeInTheDocument();
    expect(screen.getByText("Tendência de OS abertas (30d)")).toBeInTheDocument();
    expect(screen.getByText("Tendência de alertas (30d)")).toBeInTheDocument();

    expect(screen.getByText("6 ocorrência(s) em 2 alerta(s)")).toBeInTheDocument();
    expect(screen.getByText("Offline - Sem segmento")).toBeInTheDocument();
    expect(screen.getByText("9 ocorrência(s)")).toBeInTheDocument();
    expect(screen.getByText("OS-1 - Trocar HD")).toBeInTheDocument();
    expect(screen.getByText(/Aberta desde \d{2}\/\d{2}\/2026/)).toBeInTheDocument();
    expect(screen.getByText("4 OS finalizada(s)")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Visão Business" })).toBeInTheDocument();
    expect(screen.getByText("5 ordem(ns) de serviço")).toBeInTheDocument();
    expect(screen.getByText(/Alertas e ativos ainda não têm vínculo/)).toBeInTheDocument();
  });

  it("historico de avisos mostra maquina, titulo e marca resolvidos", async () => {
    render(<DashboardPage {...baseProps()} />);
    const list = document.querySelector(".history-list");
    expect(within(list).getByText("CPU alta - resolvido")).toBeInTheDocument();
    expect(within(list).getByText("Máquina não vinculada")).toBeInTheDocument();
    expect(within(list).getByText("Disco")).toBeInTheDocument();
    await reportLoaded();
  });

  it("sem relatorio mostra carregando e placeholders", () => {
    fetchDashboardSummary.mockReturnValue(new Promise(() => {}));
    render(<DashboardPage {...baseProps({ summary: null })} />);
    expect(document.querySelectorAll(".dashboard-kpi-strip-value-skeleton")).toHaveLength(4);
    expect(screen.getByText("Carregando...", { selector: ".dashboard-empty-state" })).toBeInTheDocument();
    expect(screen.queryByText("Ativos monitorados")).not.toBeInTheDocument();
  });

  it("OS vencidas indisponivel usa o tom muted; relatorio vazio mostra os vazios", async () => {
    fetchDashboardSummary.mockResolvedValue({ overview: { overdueServiceOrdersAvailable: false }, assets: {}, alerts: {}, serviceOrders: {}, business: { enabled: false, message: "Modo local" } });
    render(<DashboardPage {...baseProps({ history: [] })} />);
    expect(await screen.findByText("Indisponível", { selector: ".sr-only" })).toBeInTheDocument();
    expect(screen.getByText("Modo local")).toBeInTheDocument();
    expect(screen.getByText("Nenhum alerta ativo no momento.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma OS criada neste período.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma recorrência registrada nos últimos 30d.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma OS em aberto.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma máquina com alertas ativos.")).toBeInTheDocument();
  });

  it("negocio desligado sem mensagem mostra o texto padrao", async () => {
    fetchDashboardSummary.mockResolvedValue({ overview: {}, business: null });
    render(<DashboardPage {...baseProps()} />);
    expect(await screen.findByText("Sem dados de ambiente/organização ainda.")).toBeInTheDocument();
  });

  it("erro do relatorio mostra alerta com Tentar novamente que recarrega", async () => {
    fetchDashboardSummary.mockRejectedValueOnce(new Error("API fora")).mockResolvedValue(fullReport);
    const props = baseProps();
    const user = userEvent.setup();
    render(<DashboardPage {...props} />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("API fora");
    expect(props.notify).toHaveBeenCalledWith("API fora", "danger");
    await user.click(within(alert).getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(fetchDashboardSummary).toHaveBeenCalledTimes(2);
  });

  it("filtros: periodo recarrega com o novo periodo; busca e status chamam os setters", async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<DashboardPage {...props} />);
    await reportLoaded();
    await user.selectOptions(document.querySelector(".dashboard-period-filter select"), "7d");
    await waitFor(() => expect(fetchDashboardSummary).toHaveBeenCalledWith("tok", { period: "7d" }));
    await user.type(screen.getByLabelText("Buscar por nome, IP ou status"), "a");
    expect(props.setSearch).toHaveBeenCalledWith("a");
    await user.selectOptions(screen.getByLabelText("Filtrar por status"), "offline");
    expect(props.setStatus).toHaveBeenCalledWith("offline");
  });

  it("navegacoes: atalhos e itens clicaveis dos rankings", async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<DashboardPage {...props} />);
    await reportLoaded();
    await user.click(screen.getByText("6 ocorrência(s) em 2 alerta(s)").closest("button"));
    expect(props.onNavigateInventory).toHaveBeenCalledWith(fullReport.assets.mostProblematic[0]);
    await user.click(screen.getByText("9 ocorrência(s)").closest("button"));
    expect(props.onNavigateAlerts).toHaveBeenCalledWith(fullReport.alerts.topRecurringAssets[0]);
    await user.click(screen.getByText("OS-1 - Trocar HD").closest("button"));
    expect(props.onNavigateServiceOrders).toHaveBeenCalledWith(fullReport.serviceOrders.oldestOpen[0]);
    expect(screen.getByText("4 OS finalizada(s)").closest("button")).toBeNull();
  });

  it("lista de maquinas: selecionar chama selectDevice e mostra Carregando", async () => {
    const props = baseProps({ loading: true });
    const user = userEvent.setup();
    render(<DashboardPage {...props} />);
    expect(screen.getByText("Carregando...", { selector: ".loading" })).toBeInTheDocument();
    await user.click(screen.getByText("SRV-01", { selector: "table strong" }));
    expect(props.selectDevice).toHaveBeenCalledWith("d1");
    await reportLoaded();
  });
});
