import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBulkPrint } from "./useBulkPrint.js";

const assets = [{ id: "a" }, { id: "b" }];

describe("useBulkPrint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.print = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.className = "";
  });

  it("nao faz nada sem ativos selecionados", () => {
    const { result } = renderHook(() => useBulkPrint({ selectedAssets: [] }));
    act(() => result.current.handleBulkPrint());
    expect(result.current.bulkPrintAssets).toEqual([]);
    expect(document.body.classList.contains("qr-print-mode")).toBe(false);
  });

  it("prepara a area de impressao e limpa ao receber afterprint", () => {
    const { result } = renderHook(() => useBulkPrint({ selectedAssets: assets }));
    act(() => result.current.handleBulkPrint());
    expect(result.current.bulkPrintAssets).toEqual(assets);
    expect(document.body.classList.contains("qr-print-mode")).toBe(true);
    expect(document.body.classList.contains("bulk-qr-print-mode")).toBe(true);

    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(result.current.bulkPrintAssets).toEqual([]);
    expect(document.body.classList.contains("qr-print-mode")).toBe(false);
  });

  it("imprime depois de dois quadros e limpa por timeout se afterprint nao vier", () => {
    const { result } = renderHook(() => useBulkPrint({ selectedAssets: assets }));
    act(() => result.current.handleBulkPrint());
    act(() => result.current.handleBulkPrintReady());
    act(() => vi.advanceTimersByTime(100));
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(result.current.bulkPrintAssets).toEqual(assets);

    act(() => vi.advanceTimersByTime(1800));
    expect(result.current.bulkPrintAssets).toEqual([]);
  });

  it("remove classes e listener ao desmontar", () => {
    const { result, unmount } = renderHook(() => useBulkPrint({ selectedAssets: assets }));
    act(() => result.current.handleBulkPrint());
    unmount();
    expect(document.body.classList.contains("bulk-qr-print-mode")).toBe(false);
  });
});
