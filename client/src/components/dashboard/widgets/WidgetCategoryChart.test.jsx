import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardFilterBar, DashboardFilterProvider } from "./DashboardFilterContext.jsx";
import WidgetCategoryChart from "./WidgetCategoryChart.jsx";

vi.mock("./WidgetChartFrame.jsx", () => ({ default: ({ children }) => <div>{children}</div> }));

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
});
