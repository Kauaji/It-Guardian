import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createAlertLookups } from "../alertLookups.js";
import useAlertOverview from "./useAlertOverview.js";

const devices = [{ id: "d1", name: "PC-01" }];
const lookups = createAlertLookups({ devices });
const alerts = [{ id: "a1", status: "active", severity: "critical", assetId: "d1" }];
const history = [...alerts, { id: "a2", status: "resolved", severity: "warning", assetId: "d1" }];

function overview(centerOverrides = {}) {
  const center = { alerts, history, suggestions: [], severityFilter: "all", statusFilter: "all", ...centerOverrides };
  return renderHook(() => useAlertOverview({ center, devices, lookups })).result.current;
}

describe("useAlertOverview", () => {
  it("devolve os avisos filtrados e os indicadores", () => {
    const result = overview();

    expect(result.visibleAlerts).toHaveLength(2);
    expect(result.summary).toMatchObject({ activeMachines: 1, criticalAlerts: 1, machinesAtRisk: 1 });
    expect(result.summary.resolvedAlerts.map((alert) => alert.id)).toEqual(["a2"]);
  });

  it("aplica severidade e status do contexto somente à lista visível", () => {
    const result = overview({ severityFilter: "warning", statusFilter: "resolved" });

    expect(result.visibleAlerts.map((alert) => alert.id)).toEqual(["a2"]);
    expect(result.summary.criticalAlerts).toBe(1);
  });
});
