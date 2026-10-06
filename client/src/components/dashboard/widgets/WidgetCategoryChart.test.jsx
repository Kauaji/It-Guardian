import { cloneElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardFilterBar, DashboardFilterProvider } from "./DashboardFilterContext.jsx";
import WidgetCategoryChart from "./WidgetCategoryChart.jsx";

// Imita o ResponsiveContainer do recharts: injeta width/height e, so para tipos cujo nome termina em "Chart", o style 100%.
vi.mock("./WidgetChartFrame.jsx", () => ({
  default: ({ children }) => {
    const isChart = (children.type.displayName || children.type.name || "").endsWith("Chart");
    const style = isChart ? { height: "100%", width: "100%", ...children.props.style } : undefined;
    return <div>{cloneElement(children, { width: 400, height: 300, ...(style ? { style } : {}) })}</div>;
  }
}));

const rows = [
  { id: "a", label: "Servidor principal", value: 75, color: "#d64545" },
  { id: "b", label: "Banco", value: 25 },
  { label: "Sem filtro", value: 0 }
];

function renderChart(props, bar = false) {
  return render(
    <DashboardFilterProvider>
      <WidgetCategoryChart rows={rows} dimension="assetId" {...props} />
      {bar && <DashboardFilterBar />}
    </DashboardFilterProvider>
  );
}

describe("WidgetCategoryChart", () => {
  it("mantém o heatmap clicável para cruzar o ativo com os demais widgets", () => {
    render(
      <DashboardFilterProvider>
        <WidgetCategoryChart
          rows={[{ id: "asset-1", label: "Servidor principal", value: 82, color: "#d64545" }]}
          variant="heatmap"
          dimension="assetId"
          suffix="%"
        />
        <DashboardFilterBar />
      </DashboardFilterProvider>
    );

    const cell = screen.getByRole("button", { name: "Filtrar por Servidor principal: 82%" });
    fireEvent.click(cell);
    expect(cell).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Remover filtro Ativo: Servidor principal" })).toBeVisible();
  });

  it("mantém nome e valor acessíveis na legenda clicável do ranking radial", () => {
    render(
      <DashboardFilterProvider>
        <WidgetCategoryChart
          rows={[{ id: "asset-ram", label: "Banco de dados", value: 67, color: "#3974cc" }]}
          variant="radial"
          dimension="assetId"
          suffix="%"
        />
      </DashboardFilterProvider>
    );

    const legendItem = screen.getByRole("button", { name: "Filtrar por Banco de dados: 67%" });
    expect(legendItem).toBeVisible();
    fireEvent.click(legendItem);
    expect(legendItem).toHaveAttribute("aria-pressed", "true");
  });

  it("mantém as colunas operáveis por teclado pela legenda compacta", () => {
    render(
      <DashboardFilterProvider>
        <WidgetCategoryChart
          rows={[{ id: "asset-cpu", label: "API principal", value: 74, color: "#1f7a61" }]}
          variant="columns"
          dimension="assetId"
          suffix="%"
        />
      </DashboardFilterProvider>
    );

    const legendItem = screen.getByRole("button", { name: "Filtrar por API principal: 74%" });
    expect(legendItem).toBeVisible();
    fireEvent.keyDown(legendItem, { key: "Enter" });
    fireEvent.click(legendItem);
    expect(legendItem).toHaveAttribute("aria-pressed", "true");
  });

  it.each(["pie", "donut", "radial"])(
    "trata %s como grafico decorativo (aria-hidden, sem camada do recharts) com legenda acessivel",
    (variant) => {
      const { container } = renderChart({ variant, showPercentages: true });

      const visual = container.querySelector(".dashboard-chart-visual");
      expect(visual).toHaveAttribute("aria-hidden", "true");
      expect(visual.querySelector(".recharts-surface")).toBeInTheDocument();
      expect(visual.querySelector("[role='application']")).not.toBeInTheDocument();
      expect(visual.querySelector(".recharts-wrapper")).toHaveStyle({ width: "100%", height: "100%" });
      expect(container.firstChild).toHaveClass("dashboard-category-chart", variant === "radial" ? "radial" : "circular");

      const legend = screen.getByRole("list", { name: "Dados do gráfico" });
      expect(within(legend).getAllByRole("listitem")).toHaveLength(3);
      const first = within(legend).getByRole("button", { name: "Filtrar por Servidor principal: 75" });
      expect(first).toHaveAttribute("aria-description", "75% do total");
      expect(first).toHaveTextContent("75%");
      expect(first).toHaveAttribute("aria-pressed", "false");
      expect(within(legend).getByRole("button", { name: "Filtrar por Sem filtro: 0" })).toBeDisabled();
    }
  );

  it("renderiza barras verticais com a camada de acessibilidade do recharts e legenda", () => {
    const { container } = renderChart({ variant: "columns", suffix: "%" });

    const visual = container.querySelector(".dashboard-chart-visual");
    expect(visual).not.toHaveAttribute("aria-hidden");
    expect(container.firstChild).toHaveClass("dashboard-category-chart", "columns");
    expect(visual.querySelector(".recharts-bar")).toBeInTheDocument();
    expect(visual.querySelector(".recharts-wrapper")).toHaveStyle({ width: "100%", height: "100%" });
    expect(screen.getByRole("button", { name: "Filtrar por Banco: 25%" })).toBeEnabled();
    expect(screen.queryByText("do total")).not.toBeInTheDocument();
  });

  it("alterna a selecao pela legenda do grafico e marca o filtro ativo", () => {
    renderChart({ variant: "pie" }, true);

    const button = screen.getByRole("button", { name: "Filtrar por Banco: 25" });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Remover filtro Ativo: Banco" })).toBeVisible();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("lista barras com percentuais calculados sobre o total informado", () => {
    renderChart({ variant: "bars", showPercentages: true, percentageTotal: 200 });

    const bar = screen.getByRole("button", { name: "Filtrar por Servidor principal: 75" });
    expect(bar).toHaveAttribute("aria-description", "37,5% do total");
    expect(bar).toHaveTextContent("37,5%");
    expect(bar.querySelector(".dashboard-analytic-track span")).toHaveStyle({ width: "100%" });
  });

  it("omite a trilha na variante list e calcula percentuais pela soma das linhas", () => {
    const { container } = renderChart({ variant: "list", showPercentages: true });

    expect(container.querySelector(".dashboard-analytic-track")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtrar por Banco: 25" })).toHaveTextContent("25%");
  });

  it("renderiza estatisticas com botoes desabilitados quando nao ha dimensao de filtro", () => {
    const { container } = renderChart({ variant: "stats", dimension: undefined, showPercentages: true });

    expect(container.querySelector("dl.dashboard-category-stats")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtrar por Banco: 25" })).toBeDisabled();
    expect(container.querySelectorAll("dt")).toHaveLength(3);
  });

  it("mostra o estado vazio proprio ou o padrao quando nao ha valores", () => {
    const { unmount } = renderChart({ rows: [], emptyMessage: "Sem ativos" });
    expect(screen.getByText("Sem ativos")).toHaveClass("dashboard-empty-state");
    unmount();
    renderChart({ rows: [{ id: "z", label: "Z", value: 0 }] });
    expect(screen.getByText(/Nenhum dado neste recorte/)).toBeVisible();
  });
});
