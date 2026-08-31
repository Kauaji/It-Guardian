import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AssetAvailabilityWidget from "./AssetAvailabilityWidget.jsx";

vi.mock("../WidgetChartFrame.jsx", () => ({ default: () => <div data-testid="chart-frame" /> }));

describe("AssetAvailabilityWidget", () => {
  it("mostra contagem e percentual de cada status", () => {
    const { container } = render(<AssetAvailabilityWidget data={{ total: 8, byStatus: { online: 4, offline: 2, problem: 1, unknown: 1 } }} />);

    expect(container.querySelector(".dashboard-category-chart.circular")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeVisible();
    expect(screen.getByText("25%")).toBeVisible();
    expect(screen.getAllByText("12,5%")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Filtrar por Online: 4" })).toHaveAttribute("aria-description", "50% do total");
  });

  it("mantém o estado vazio sem NaN ou Infinity quando o total é zero", () => {
    render(<AssetAvailabilityWidget data={{ total: 0, byStatus: { online: 0, offline: 0, problem: 0, unknown: 0 } }} />);

    expect(screen.getByText("Nenhum ativo neste recorte.")).toBeVisible();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });
});
