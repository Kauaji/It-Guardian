import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createAlertLookups } from "../alertLookups.js";
import useAlertSuggestions from "./useAlertSuggestions.js";

const devices = [
  { id: "d1", name: "PC-01" },
  { id: "d2", name: "PC-02" }
];
const lookups = createAlertLookups({ devices });
const suggestions = [
  { id: "a", status: "pending", suggestedPriority: "low", assetId: "d1", alertType: "cpu_high", createdAt: "2026-05-01T00:00:00.000Z" },
  {
    id: "b",
    status: "pending",
    suggestedPriority: "critical",
    assetId: "d2",
    alertType: "ram_high",
    createdAt: "2026-05-02T00:00:00.000Z"
  },
  { id: "c", status: "accepted", assetId: "d1", createdAt: "2026-05-03T00:00:00.000Z" }
];

function setup(overrides = {}) {
  return renderHook((props) => useAlertSuggestions(props), {
    initialProps: { suggestions, devices, statusFilter: "all", lookups, alertCorrelations: [], ...overrides }
  });
}

describe("useAlertSuggestions", () => {
  it("expõe as sugestões visíveis consolidadas e ordenadas", () => {
    const { result } = setup();

    expect(result.current.visibleSuggestions.map((item) => item.assetId)).toEqual(["d2", "d1"]);
    expect(result.current.selectedSuggestion).toBeNull();
    expect(result.current.selectedModel).toBeNull();
  });

  it("aplica o filtro de status", () => {
    const { result } = setup({ statusFilter: "validation_cancelled" });

    expect(result.current.visibleSuggestions).toEqual([]);
  });

  it("seleciona uma sugestão e monta o modelo de detalhes com o índice do código", () => {
    const { result } = setup();

    act(() => result.current.openInfo("b"));

    expect(result.current.selectedSuggestion.id).toBe("b");
    expect(result.current.selectedModel).toMatchObject({ machineLabel: "PC-02", priority: "critical" });
    expect(result.current.selectedIndex).toBe(0);

    act(() => result.current.openInfo("c"));
    expect(result.current.selectedIndex).toBe(2);
  });

  it("fecha os detalhes e ignora ids inexistentes", () => {
    const { result } = setup();

    act(() => result.current.openInfo("b"));
    act(() => result.current.closeInfo());
    expect(result.current.selectedSuggestion).toBeNull();

    act(() => result.current.openInfo("não-existe"));
    expect(result.current.selectedSuggestion).toBeNull();
    expect(result.current.selectedModel).toBeNull();
  });
});
