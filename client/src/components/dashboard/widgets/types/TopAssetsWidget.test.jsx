import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TopAssetsWidget from "./TopAssetsWidget.jsx";

vi.mock("../WidgetChartFrame.jsx", () => ({ default: () => <div data-testid="chart-frame" /> }));

describe("TopAssetsWidget", () => {
  it.each([
    ["cpu", ".dashboard-category-chart.columns"],
    ["ram", ".dashboard-category-chart.radial"],
    ["disk", ".dashboard-heatmap-grid"]
  ])("aplica a assinatura operacional padrão de %s sem configuração salva", (metric, selector) => {
    const { container } = render(<TopAssetsWidget data={{ metric, rows: [{ id: `asset-${metric}`, name: `Ativo ${metric}`, value: 68 }] }} />);

    expect(container.querySelector(selector)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Filtrar por Ativo ${metric}: 68%` })).toBeVisible();
  });
});
