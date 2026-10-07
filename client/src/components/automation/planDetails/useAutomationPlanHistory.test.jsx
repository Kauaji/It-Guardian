import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useAutomationPlanHistory from "./useAutomationPlanHistory.js";

describe("useAutomationPlanHistory", () => {
  it("só carrega quando a aba Histórico está aberta", async () => {
    const onLoadHistory = vi.fn().mockResolvedValue({ items: [{ id: "h1" }] });
    const { result, rerender } = renderHook((props) => useAutomationPlanHistory(props), {
      initialProps: { open: true, activeTab: "summary", planId: "p1", onLoadHistory }
    });

    expect(onLoadHistory).not.toHaveBeenCalled();
    rerender({ open: true, activeTab: "history", planId: "p1", onLoadHistory });

    await waitFor(() => expect(result.current.history).toEqual([{ id: "h1" }]));
    expect(onLoadHistory).toHaveBeenCalledWith("p1");
    expect(result.current.historyLoading).toBe(false);
  });

  it("não carrega com o modal fechado ou sem função de carga", () => {
    const onLoadHistory = vi.fn().mockResolvedValue({ items: [] });
    renderHook(() => useAutomationPlanHistory({ open: false, activeTab: "history", planId: "p1", onLoadHistory }));
    const semCarga = renderHook(() => useAutomationPlanHistory({ open: true, activeTab: "history", planId: "p1" }));

    expect(onLoadHistory).not.toHaveBeenCalled();
    expect(semCarga.result.current.historyLoading).toBe(false);
  });

  it("indica o carregamento enquanto a promessa não resolve", async () => {
    let finish;
    const onLoadHistory = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { result } = renderHook(() => useAutomationPlanHistory({ open: true, activeTab: "history", planId: "p1", onLoadHistory }));

    await waitFor(() => expect(result.current.historyLoading).toBe(true));
    await act(async () => finish({ items: undefined }));

    expect(result.current.historyLoading).toBe(false);
    expect(result.current.history).toEqual([]);
  });

  it("descarta o histórico ao trocar de plano", async () => {
    const onLoadHistory = vi.fn().mockResolvedValue({ items: [{ id: "h1" }] });
    const { result, rerender } = renderHook((props) => useAutomationPlanHistory(props), {
      initialProps: { open: true, activeTab: "history", planId: "p1", onLoadHistory }
    });

    await waitFor(() => expect(result.current.history).toHaveLength(1));
    rerender({ open: true, activeTab: "summary", planId: "p2", onLoadHistory });

    await waitFor(() => expect(result.current.history).toEqual([]));
  });
});
