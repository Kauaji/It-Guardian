import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api.js", () => ({
  previewDashboardWidget: vi.fn()
}));

import { previewDashboardWidget } from "../api.js";
import { useWidgetData } from "./useWidgetData.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("useWidgetData", () => {
  it("busca os dados do widget assim que habilitado", async () => {
    previewDashboardWidget.mockResolvedValue({ type: "asset_availability", data: { total: 3 } });

    const { result } = renderHook(() =>
      useWidgetData({ token: "tok", type: "asset_availability", config: {}, refreshIntervalSeconds: 60 })
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));

    expect(result.current.data).toEqual({ total: 3 });
    expect(previewDashboardWidget).toHaveBeenCalledTimes(1);
    expect(previewDashboardWidget).toHaveBeenCalledWith(
      "tok",
      { type: "asset_availability", config: {} },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("nao busca nada quando enabled e false", async () => {
    renderHook(() =>
      useWidgetData({ token: "tok", type: "asset_availability", config: {}, refreshIntervalSeconds: 60, enabled: false })
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(previewDashboardWidget).not.toHaveBeenCalled();
  });

  it("agenda o proximo poll respeitando refreshIntervalSeconds", async () => {
    previewDashboardWidget.mockResolvedValue({ type: "t", data: { value: 1 } });
    renderHook(() => useWidgetData({ token: "tok", type: "t", config: {}, refreshIntervalSeconds: 60 }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(previewDashboardWidget).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(59000));
    expect(previewDashboardWidget).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(previewDashboardWidget).toHaveBeenCalledTimes(2);
  });

  it("nunca agenda um poll mais rapido que 30s, mesmo se configurado abaixo disso", async () => {
    previewDashboardWidget.mockResolvedValue({ type: "t", data: { value: 1 } });
    renderHook(() => useWidgetData({ token: "tok", type: "t", config: {}, refreshIntervalSeconds: 5 }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(previewDashboardWidget).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(29000));
    expect(previewDashboardWidget).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(previewDashboardWidget).toHaveBeenCalledTimes(2);
  });

  it("expoe o erro sem inventar dado quando a chamada falha", async () => {
    previewDashboardWidget.mockRejectedValue(new Error("Falha real do servidor"));
    const { result } = renderHook(() =>
      useWidgetData({ token: "tok", type: "t", config: {}, refreshIntervalSeconds: 60 })
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));

    expect(result.current.error).toBe("Falha real do servidor");
    expect(result.current.data).toBeNull();
  });

  it("aborta a requisicao ao desmontar", async () => {
    let capturedSignal = null;
    previewDashboardWidget.mockImplementation((token, params, { signal }) => {
      capturedSignal = signal;
      return new Promise(() => {}); // nunca resolve, simula requisicao em andamento
    });

    const { unmount } = renderHook(() =>
      useWidgetData({ token: "tok", type: "t", config: {}, refreshIntervalSeconds: 60 })
    );

    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal.aborted).toBe(false);
    unmount();
    expect(capturedSignal.aborted).toBe(true);
  });

  it("refaz a busca quando a config muda, mesmo antes do proximo poll agendado", async () => {
    previewDashboardWidget.mockResolvedValue({ type: "t", data: { value: 1 } });
    const { rerender } = renderHook(
      ({ config }) => useWidgetData({ token: "tok", type: "t", config, refreshIntervalSeconds: 60 }),
      { initialProps: { config: { assetId: "a" } } }
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(previewDashboardWidget).toHaveBeenCalledTimes(1);

    rerender({ config: { assetId: "b" } });
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(previewDashboardWidget).toHaveBeenCalledTimes(2);
    expect(previewDashboardWidget).toHaveBeenLastCalledWith(
      "tok",
      { type: "t", config: { assetId: "b" } },
      expect.anything()
    );
  });
});
