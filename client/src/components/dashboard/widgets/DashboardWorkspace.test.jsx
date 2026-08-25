import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api.js", () => ({
  fetchDashboardLayout: vi.fn(),
  saveDashboardLayout: vi.fn(),
  resetDashboardLayout: vi.fn(),
  fetchDashboardWidgetCatalog: vi.fn(),
  previewDashboardWidget: vi.fn(),
  fetchDevices: vi.fn()
}));

import {
  fetchDashboardLayout,
  fetchDashboardWidgetCatalog,
  previewDashboardWidget,
  resetDashboardLayout,
  saveDashboardLayout
} from "../../../api.js";
import DashboardWorkspace from "./DashboardWorkspace.jsx";

function widget(overrides = {}) {
  return {
    id: "w1",
    type: "asset_availability",
    x: 0,
    y: 0,
    w: "m",
    h: "s",
    refreshIntervalSeconds: 60,
    config: {},
    ...overrides
  };
}

function baseCatalog() {
  return [
    { type: "asset_availability", label: "Disponibilidade de Ativos", category: "assets", defaultSize: { w: "m", h: "s" } },
    { type: "recent_events", label: "Ultimos Eventos Tecnicos", category: "events", defaultSize: { w: "l", h: "m" } }
  ];
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("DashboardWorkspace", () => {
  it("renderiza os widgets do layout salvo, com o titulo de cada um", async () => {
    fetchDashboardLayout.mockResolvedValue({ widgets: [widget()] });
    previewDashboardWidget.mockResolvedValue({ type: "asset_availability", data: { total: 0, byStatus: {} } });

    render(<DashboardWorkspace token="tok" canCustomize />);

    await waitFor(() => expect(screen.getByText("Disponibilidade de Ativos")).toBeTruthy());
    expect(screen.queryByText("Editar dashboard")).toBeTruthy();
  });

  it("entra em modo edicao e mostra os botoes de edicao", async () => {
    fetchDashboardLayout.mockResolvedValue({ widgets: [widget()] });
    previewDashboardWidget.mockResolvedValue({ type: "asset_availability", data: {} });

    render(<DashboardWorkspace token="tok" canCustomize />);
    await waitFor(() => expect(screen.getByText("Disponibilidade de Ativos")).toBeTruthy());

    fireEvent.click(screen.getByText("Editar dashboard"));

    expect(screen.getByText("Adicionar widget")).toBeTruthy();
    expect(screen.getByText("Salvar layout")).toBeTruthy();
    expect(screen.getByText("Restaurar padrao")).toBeTruthy();
  });

  it("nao mostra o botao de editar quando o usuario nao tem dashboard.customize", async () => {
    fetchDashboardLayout.mockResolvedValue({ widgets: [widget()] });
    previewDashboardWidget.mockResolvedValue({ type: "asset_availability", data: {} });

    render(<DashboardWorkspace token="tok" canCustomize={false} />);
    await waitFor(() => expect(screen.getByText("Disponibilidade de Ativos")).toBeTruthy());

    expect(screen.queryByText("Editar dashboard")).toBeNull();
  });

  it("adiciona um widget do catalogo ao draft, sem persistir ate salvar", async () => {
    fetchDashboardLayout.mockResolvedValue({ widgets: [widget()] });
    fetchDashboardWidgetCatalog.mockResolvedValue({ widgets: baseCatalog() });
    previewDashboardWidget.mockResolvedValue({ type: "t", data: {} });

    render(<DashboardWorkspace token="tok" canCustomize />);
    await waitFor(() => expect(screen.getByText("Disponibilidade de Ativos")).toBeTruthy());

    fireEvent.click(screen.getByText("Editar dashboard"));
    fireEvent.click(screen.getByText("Adicionar widget"));

    await waitFor(() => expect(screen.getAllByText("Ultimos Eventos Tecnicos").length).toBeGreaterThan(0));
    const catalogCard = screen.getAllByText("Ultimos Eventos Tecnicos")[0].closest("button");
    fireEvent.click(catalogCard);

    await waitFor(() => {
      const titles = screen.getAllByText("Ultimos Eventos Tecnicos");
      expect(titles.some((node) => node.tagName === "H4")).toBe(true);
    });
    expect(saveDashboardLayout).not.toHaveBeenCalled();
  });

  it("remove um widget do draft ao clicar Remover no menu", async () => {
    fetchDashboardLayout.mockResolvedValue({ widgets: [widget(), widget({ id: "w2", type: "recent_events" })] });
    previewDashboardWidget.mockResolvedValue({ type: "t", data: {} });

    render(<DashboardWorkspace token="tok" canCustomize />);
    await waitFor(() => expect(screen.getByText("Disponibilidade de Ativos")).toBeTruthy());

    fireEvent.click(screen.getByText("Editar dashboard"));
    const menuButtons = screen.getAllByTitle("Opcoes do widget");
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText("Remover"));

    await waitFor(() => expect(screen.queryByText("Disponibilidade de Ativos")).toBeNull());
  });

  it("cancelar descarta as mudancas do draft sem chamar a API de salvar", async () => {
    fetchDashboardLayout.mockResolvedValue({ widgets: [widget()] });
    previewDashboardWidget.mockResolvedValue({ type: "t", data: {} });

    render(<DashboardWorkspace token="tok" canCustomize />);
    await waitFor(() => expect(screen.getByText("Disponibilidade de Ativos")).toBeTruthy());

    fireEvent.click(screen.getByText("Editar dashboard"));
    const menuButtons = screen.getAllByTitle("Opcoes do widget");
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText("Remover"));
    await waitFor(() => expect(screen.queryByText("Disponibilidade de Ativos")).toBeNull());

    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => expect(screen.getByText("Disponibilidade de Ativos")).toBeTruthy());
    expect(saveDashboardLayout).not.toHaveBeenCalled();
  });

  it("salvar chama a API com o draft atual e volta ao modo visualizacao", async () => {
    fetchDashboardLayout.mockResolvedValue({ widgets: [widget()] });
    previewDashboardWidget.mockResolvedValue({ type: "t", data: {} });
    saveDashboardLayout.mockResolvedValue({ widgets: [widget()] });

    render(<DashboardWorkspace token="tok" canCustomize />);
    await waitFor(() => expect(screen.getByText("Disponibilidade de Ativos")).toBeTruthy());

    fireEvent.click(screen.getByText("Editar dashboard"));
    await act(async () => {
      fireEvent.click(screen.getByText("Salvar layout"));
    });

    expect(saveDashboardLayout).toHaveBeenCalledWith("tok", { widgets: [widget()] });
    await waitFor(() => expect(screen.queryByText("Salvar layout")).toBeNull());
  });

  it("restaurar padrao chama a API de reset e atualiza o draft", async () => {
    fetchDashboardLayout.mockResolvedValue({ widgets: [widget()] });
    previewDashboardWidget.mockResolvedValue({ type: "t", data: {} });
    resetDashboardLayout.mockResolvedValue({ widgets: [widget({ id: "default-1", type: "status_overview" })] });

    render(<DashboardWorkspace token="tok" canCustomize />);
    await waitFor(() => expect(screen.getByText("Disponibilidade de Ativos")).toBeTruthy());

    fireEvent.click(screen.getByText("Editar dashboard"));
    await act(async () => {
      fireEvent.click(screen.getByText("Restaurar padrao"));
    });

    expect(resetDashboardLayout).toHaveBeenCalledWith("tok");
  });

  it("redimensionar chama o resize sem persistir ate salvar", async () => {
    fetchDashboardLayout.mockResolvedValue({ widgets: [widget({ w: "m" })] });
    previewDashboardWidget.mockResolvedValue({ type: "t", data: {} });

    const { container } = render(<DashboardWorkspace token="tok" canCustomize />);
    await waitFor(() => expect(screen.getByText("Disponibilidade de Ativos")).toBeTruthy());

    fireEvent.click(screen.getByText("Editar dashboard"));
    fireEvent.click(screen.getAllByTitle("Opcoes do widget")[0]);

    const card = container.querySelector(".dashboard-widget-card");
    const widthPicker = within(card).getByText("Largura").closest("fieldset");
    fireEvent.click(within(widthPicker).getByText("Largo"));

    expect(getComputedStyle(card).gridColumn).toBe("span 12");
    expect(saveDashboardLayout).not.toHaveBeenCalled();
  });
});
