import { describe, expect, it } from "vitest";
import { buildKpiItems, buildReportSlices } from "./reportSlices.js";

describe("buildReportSlices", () => {
  it("sem relatorio devolve listas vazias e objetos nulos", () => {
    const slices = buildReportSlices(null);
    expect(slices.overview).toBeNull();
    expect(slices.business).toBeNull();
    for (const key of ["byStatus", "bySeverity", "soByStatus", "soByPriority", "soTrend", "alertsTrend", "mostProblematic", "notSeenRecently", "topRecurringAssets", "oldestOpen", "byTechnician", "byEnvironment"]) {
      expect(slices[key]).toEqual([]);
    }
  });

  it("distribui cada parte do relatorio", () => {
    const report = {
      overview: { openServiceOrders: 1 },
      assets: { byStatus: [1], mostProblematic: [2], notSeenRecently: [3] },
      alerts: { bySeverity: [4], trend: [5], topRecurringAssets: [6] },
      serviceOrders: { byStatus: [7], byPriority: [8], trend: [9], oldestOpen: [10], byTechnician: [11] },
      business: { byEnvironment: [12] }
    };
    const slices = buildReportSlices(report);
    expect(slices).toMatchObject({
      overview: { openServiceOrders: 1 },
      byStatus: [1], mostProblematic: [2], notSeenRecently: [3],
      bySeverity: [4], alertsTrend: [5], topRecurringAssets: [6],
      soByStatus: [7], soByPriority: [8], soTrend: [9], oldestOpen: [10], byTechnician: [11],
      byEnvironment: [12]
    });
  });
});

describe("buildKpiItems", () => {
  it("sem overview mostra placeholders e OS vencidas indisponivel", () => {
    const items = buildKpiItems(null);
    expect(items.map((i) => i.value)).toEqual(["--", "Indisponível", "--", "--"]);
    expect(items[1].tone).toBe("muted");
    expect(items[3].tone).toBe("ok");
  });

  it("com overview usa os valores e libera OS vencidas quando disponivel", () => {
    const items = buildKpiItems({
      openServiceOrders: 4, overdueServiceOrdersAvailable: true, overdueServiceOrders: 1, inMaintenanceAssets: 2, resolvedAlertsToday: 9
    });
    expect(items.map((i) => i.value)).toEqual([4, 1, 2, 9]);
    expect(items[1].tone).toBe("");
  });
});
