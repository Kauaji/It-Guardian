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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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

  it("envia filtros separados do config salvo e refaz a query quando a selecao muda", async () => {
    previewDashboardWidget.mockResolvedValue({ type: "metric_gauge_cpu", data: { value: 42 } });
    const config = Object.freeze({ assetId: "configured-asset", chartType: "gauge" });
    const { rerender } = renderHook(
      ({ filters }) => useWidgetData({ token: "tok", type: "metric_gauge_cpu", config, filters, refreshIntervalSeconds: 60 }),
      { initialProps: { filters: { assetId: "selected-a" } } }
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));

    expect(previewDashboardWidget).toHaveBeenLastCalledWith(
      "tok",
      { type: "metric_gauge_cpu", config, filters: { assetId: "selected-a" } },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    rerender({ filters: { assetId: "selected-b", overdue: false } });
    await act(async () => vi.advanceTimersByTimeAsync(0));

    expect(previewDashboardWidget).toHaveBeenCalledTimes(2);
    expect(previewDashboardWidget).toHaveBeenLastCalledWith(
      "tok",
      { type: "metric_gauge_cpu", config, filters: { assetId: "selected-b", overdue: false } },
      expect.anything()
    );
    expect(config.assetId).toBe("configured-asset");
  });

  it("nao refaz a query apenas por receber outro objeto de filtros com os mesmos valores", async () => {
    previewDashboardWidget.mockResolvedValue({ type: "asset_availability", data: { total: 3 } });
    const { rerender } = renderHook(
      ({ filters }) => useWidgetData({ token: "tok", type: "asset_availability", config: {}, filters, refreshIntervalSeconds: 60 }),
      { initialProps: { filters: { assetStatus: "online" } } }
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));
    rerender({ filters: { assetStatus: "online" } });
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(previewDashboardWidget).toHaveBeenCalledTimes(1);
  });

  it("remove imediatamente os dados do recorte anterior enquanto o novo filtro carrega", async () => {
    const next = deferred();
    previewDashboardWidget
      .mockResolvedValueOnce({ data: { total: 8 } })
      .mockImplementationOnce(() => next.promise);
    const { result, rerender } = renderHook(
      ({ filters }) => useWidgetData({ token: "tok", type: "asset_availability", config: {}, filters, refreshIntervalSeconds: 60 }),
      { initialProps: { filters: { assetStatus: "online" } } }
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.data).toEqual({ total: 8 });
    const oldSignal = previewDashboardWidget.mock.calls[0][2].signal;

    rerender({ filters: { assetStatus: "offline" } });
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("");
    expect(result.current.loading).toBe(true);

    await act(async () => { next.resolve({ data: { total: 2 } }); });
    expect(result.current.data).toEqual({ total: 2 });
    expect(result.current.loading).toBe(false);
  });

  it("falha do novo filtro nao reapresenta dados validos de outro recorte", async () => {
    const next = deferred();
    previewDashboardWidget
      .mockResolvedValueOnce({ data: { total: 8 } })
      .mockImplementationOnce(() => next.promise);
    const { result, rerender } = renderHook(
      ({ filters }) => useWidgetData({ token: "tok", type: "asset_availability", config: {}, filters, refreshIntervalSeconds: 60 }),
      { initialProps: { filters: {} } }
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));
    rerender({ filters: { alertSeverity: "critical" } });
    await act(async () => { next.reject(new Error("Recorte indisponivel")); });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Recorte indisponivel");
    expect(result.current.loading).toBe(false);
  });

  it("aborta a query antiga e ignora resposta atrasada mesmo se o transporte nao respeita o aborto", async () => {
    const oldQuery = deferred();
    const newQuery = deferred();
    previewDashboardWidget
      .mockImplementationOnce(() => oldQuery.promise)
      .mockImplementationOnce(() => newQuery.promise)
      .mockResolvedValueOnce({ data: { total: 4 } });
    const { result, rerender } = renderHook(
      ({ filters }) => useWidgetData({ token: "tok", type: "asset_availability", config: {}, filters, refreshIntervalSeconds: 60 }),
      { initialProps: { filters: { assetStatus: "online" } } }
    );
    const oldSignal = previewDashboardWidget.mock.calls[0][2].signal;
    rerender({ filters: { assetStatus: "offline" } });
    expect(oldSignal.aborted).toBe(true);
    expect(previewDashboardWidget.mock.calls[1][2].signal.aborted).toBe(false);

    await act(async () => { newQuery.resolve({ data: { total: 3 } }); });
    expect(result.current.data).toEqual({ total: 3 });
    await act(async () => { oldQuery.resolve({ data: { total: 99 } }); });
    expect(result.current.data).toEqual({ total: 3 });
    expect(result.current.error).toBe("");

    // Only the surviving scope schedules another poll.
    await act(async () => vi.advanceTimersByTimeAsync(60000));
    expect(previewDashboardWidget).toHaveBeenCalledTimes(3);
    expect(previewDashboardWidget.mock.calls[2][1].filters).toEqual({ assetStatus: "offline" });
    expect(result.current.data).toEqual({ total: 4 });
  });

  it("erro tardio da query cancelada nao contamina nem encerra o carregamento do novo filtro", async () => {
    const oldQuery = deferred();
    const newQuery = deferred();
    previewDashboardWidget
      .mockImplementationOnce(() => oldQuery.promise)
      .mockImplementationOnce(() => newQuery.promise);
    const { result, rerender } = renderHook(
      ({ filters }) => useWidgetData({ token: "tok", type: "asset_availability", config: {}, filters, refreshIntervalSeconds: 60 }),
      { initialProps: { filters: { assetStatus: "online" } } }
    );
    rerender({ filters: { assetStatus: "offline" } });
    // apiFetch may wrap AbortError in a generic connection error; cancellation
    // must still be authoritative and prevent this old error from surfacing.
    await act(async () => { oldQuery.reject(new Error("Nao foi possivel conectar ao servidor")); });
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("");
    expect(result.current.loading).toBe(true);

    await act(async () => { newQuery.resolve({ data: { total: 3 } }); });
    expect(result.current.data).toEqual({ total: 3 });
    expect(result.current.loading).toBe(false);
  });

  it("limpar filtros volta ao payload sem filters e recupera a configuracao original", async () => {
    const globalQuery = deferred();
    const config = Object.freeze({ assetId: "configured-asset" });
    previewDashboardWidget
      .mockResolvedValueOnce({ data: { assetId: "selected-asset", value: 92 } })
      .mockImplementationOnce(() => globalQuery.promise);
    const { result, rerender } = renderHook(
      ({ filters }) => useWidgetData({ token: "tok", type: "metric_gauge_cpu", config, filters, refreshIntervalSeconds: 60 }),
      { initialProps: { filters: { assetId: "selected-asset", assetStatus: "online" } } }
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.data.assetId).toBe("selected-asset");

    rerender({ filters: {} });
    expect(result.current.data).toBeNull();
    expect(previewDashboardWidget).toHaveBeenLastCalledWith(
      "tok", { type: "metric_gauge_cpu", config }, expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(previewDashboardWidget.mock.calls[1][1]).not.toHaveProperty("filters");
    await act(async () => { globalQuery.resolve({ data: { assetId: "configured-asset", value: 22 } }); });
    expect(result.current.data).toEqual({ assetId: "configured-asset", value: 22 });

    rerender({ filters: undefined });
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(previewDashboardWidget).toHaveBeenCalledTimes(2);
    expect(config.assetId).toBe("configured-asset");
  });

  it("mantem a ultima leitura apenas quando uma atualizacao do MESMO recorte falha", async () => {
    previewDashboardWidget
      .mockResolvedValueOnce({ data: { total: 5 } })
      .mockRejectedValueOnce(new Error("Atualizacao temporariamente indisponivel"));
    const { result } = renderHook(() => useWidgetData({
      token: "tok", type: "asset_availability", config: {}, filters: { assetStatus: "online" }, refreshIntervalSeconds: 60
    }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => vi.advanceTimersByTimeAsync(60000));

    expect(result.current.data).toEqual({ total: 5 });
    expect(result.current.error).toBe("Atualizacao temporariamente indisponivel");
    expect(result.current.loading).toBe(false);
  });

  it("trocar o usuario invalida o snapshot mesmo com tipo, config e filtros identicos", async () => {
    const secondUser = deferred();
    previewDashboardWidget
      .mockResolvedValueOnce({ data: { total: 12 } })
      .mockImplementationOnce(() => secondUser.promise);
    const { result, rerender } = renderHook(
      ({ token }) => useWidgetData({ token, type: "asset_availability", config: {}, filters: { assetStatus: "online" }, refreshIntervalSeconds: 60 }),
      { initialProps: { token: "first-user" } }
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.data).toEqual({ total: 12 });
    const oldSignal = previewDashboardWidget.mock.calls[0][2].signal;
    rerender({ token: "second-user" });
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.data).toBeNull();
    await act(async () => { secondUser.resolve({ data: { total: 1 } }); });
    expect(result.current.data).toEqual({ total: 1 });
  });
});
