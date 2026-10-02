import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import usePreventiveAutomationToggle from "./usePreventiveAutomationToggle.js";

describe("usePreventiveAutomationToggle", () => {
  it("desativa planos ativos pelo handler de desativação", async () => {
    const onDisable = vi.fn().mockResolvedValue(undefined);
    const onSave = vi.fn();
    const { result } = renderHook(() => usePreventiveAutomationToggle({ onSave, onDisable }));

    await act(async () => result.current.toggleAutomationPlan({ id: "p1", name: "Plano", active: true }));

    expect(onDisable).toHaveBeenCalledWith("p1");
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.togglingId).toBeNull();
  });

  it("reativa planos inativos regravando o plano", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePreventiveAutomationToggle({ onSave, onDisable: vi.fn() }));

    await act(async () => result.current.toggleAutomationPlan({ id: "p2", name: "Plano", active: false, scopeType: "all" }));

    expect(onSave).toHaveBeenCalledWith("p2", expect.objectContaining({ active: true, name: "Plano", scopeId: null }));
  });

  it("regrava com active true quando não há handler de desativação", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePreventiveAutomationToggle({ onSave }));

    await act(async () => result.current.toggleAutomationPlan({ id: "p3", name: "Plano", active: true }));

    expect(onSave).toHaveBeenCalledWith("p3", expect.objectContaining({ active: true }));
  });

  it("não faz nada sem nenhum handler", async () => {
    const { result } = renderHook(() => usePreventiveAutomationToggle({}));

    await act(async () => result.current.toggleAutomationPlan({ id: "p4", active: false }));

    expect(result.current.togglingId).toBeNull();
  });

  it("marca o plano em processamento e ignora cliques repetidos", async () => {
    let finish;
    const onDisable = vi.fn().mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => usePreventiveAutomationToggle({ onDisable }));

    let first;
    act(() => { first = result.current.toggleAutomationPlan({ id: "p1", active: true }); });
    expect(result.current.togglingId).toBe("p1");
    await act(async () => result.current.toggleAutomationPlan({ id: "p2", active: true }));
    expect(onDisable).toHaveBeenCalledTimes(1);

    await act(async () => { finish(); await first; });
    expect(result.current.togglingId).toBeNull();
  });

  it("libera o estado mesmo quando a chamada falha", async () => {
    const onDisable = vi.fn().mockRejectedValue(new Error("falhou"));
    const { result } = renderHook(() => usePreventiveAutomationToggle({ onDisable }));

    await act(async () => {
      await result.current.toggleAutomationPlan({ id: "p1", active: true }).catch(() => {});
    });

    expect(result.current.togglingId).toBeNull();
  });
});
