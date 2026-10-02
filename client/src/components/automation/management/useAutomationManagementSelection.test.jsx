import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useAutomationManagementSelection from "./useAutomationManagementSelection.js";

const management = {
  plans: [{ id: 1, name: "A" }, { id: "2", name: "B" }],
  machines: [{ assetId: "d1", assetName: "PC-01" }]
};

describe("useAutomationManagementSelection", () => {
  it("abre o plano completo da gestão e fecha a máquina selecionada", () => {
    const { result } = renderHook(() => useAutomationManagementSelection(management));

    act(() => result.current.setSelectedMachine(management.machines[0]));
    act(() => result.current.openPlan({ automationPlanId: "2" }, management.machines[0]));

    expect(result.current.selectedPlan).toBe(management.plans[1]);
    expect(result.current.selectedMachine).toBeNull();
  });

  it("abre o plano recebido quando não está na gestão e mantém a máquina sem o segundo argumento", () => {
    const { result } = renderHook(() => useAutomationManagementSelection(management));
    const external = { id: "x", name: "Externo" };

    act(() => result.current.setSelectedMachine(management.machines[0]));
    act(() => result.current.openPlan(external));

    expect(result.current.selectedPlan).toBe(external);
    expect(result.current.selectedMachine).toBe(management.machines[0]);
  });

  it("sincroniza plano e máquina selecionados com a gestão recarregada", async () => {
    const { result, rerender } = renderHook((value) => useAutomationManagementSelection(value), { initialProps: management });

    act(() => result.current.setSelectedPlan(management.plans[0]));
    act(() => result.current.setSelectedMachine(management.machines[0]));
    const refreshed = {
      plans: [{ id: 1, name: "A renomeado" }],
      machines: [{ assetId: "d1", assetName: "PC-01 renomeado" }]
    };
    rerender(refreshed);

    await waitFor(() => expect(result.current.selectedPlan).toBe(refreshed.plans[0]));
    expect(result.current.selectedMachine).toBe(refreshed.machines[0]);
  });

  it("limpa a máquina que sumiu da gestão mas preserva o plano que sumiu", async () => {
    const { result, rerender } = renderHook((value) => useAutomationManagementSelection(value), { initialProps: management });

    act(() => result.current.setSelectedPlan(management.plans[0]));
    act(() => result.current.setSelectedMachine(management.machines[0]));
    rerender({ plans: [], machines: [] });

    await waitFor(() => expect(result.current.selectedMachine).toBeNull());
    expect(result.current.selectedPlan).toBe(management.plans[0]);
  });

  it("executa uma gravação por vez e libera o estado ao terminar ou falhar", async () => {
    const { result } = renderHook(() => useAutomationManagementSelection(management));
    let finish;
    let first;

    act(() => { first = result.current.run(() => new Promise((resolve) => { finish = resolve; })); });
    expect(result.current.saving).toBe(true);

    let secondRan = false;
    await act(async () => result.current.run(async () => { secondRan = true; }));
    expect(secondRan).toBe(false);

    await act(async () => { finish(); await first; });
    expect(result.current.saving).toBe(false);

    await act(async () => {
      await result.current.run(async () => { throw new Error("falhou"); }).catch(() => {});
    });
    expect(result.current.saving).toBe(false);
  });
});
