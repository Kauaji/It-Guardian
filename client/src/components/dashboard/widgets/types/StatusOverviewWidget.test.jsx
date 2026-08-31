import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatusOverviewWidget from "./StatusOverviewWidget.jsx";

describe("StatusOverviewWidget", () => {
  it("preserva as OS sem ativo vinculado e não mostra saúde 100 para um recorte sem máquinas", () => {
    const { container } = render(<StatusOverviewWidget data={{ totalAssets: 0, onlineAssets: 0, offlineAssets: 0, criticalAssets: 0, openServiceOrders: 3, overdueServiceOrders: 2, criticalAlerts: 0, health: { score: 100, classification: "healthy", classificationLabel: "Saudável" } }} />);
    expect(screen.queryByRole("img", { name: /Saúde/ })).toBeNull();
    expect(screen.queryByText("Saudável")).toBeNull();
    expect(screen.getByText("Saúde indisponível neste recorte")).toBeTruthy();
    expect(within(screen.getByText("OS abertas").closest("div")).getByText("3")).toBeTruthy();
    expect(container.querySelectorAll("dt")).toHaveLength(7);
  });
});
