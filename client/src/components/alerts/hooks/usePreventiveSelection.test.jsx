import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import usePreventiveSelection from "./usePreventiveSelection.js";

describe("usePreventiveSelection", () => {
  it("alterna máquinas, scripts e descrições expandidas", () => {
    const { result } = renderHook(() => usePreventiveSelection());

    act(() => result.current.toggleAsset("d1"));
    act(() => result.current.toggleScript("s1"));
    act(() => result.current.toggleScriptDetails("s1"));
    expect([...result.current.assets]).toEqual(["d1"]);
    expect([...result.current.scripts]).toEqual(["s1"]);
    expect([...result.current.expandedScripts]).toEqual(["s1"]);

    act(() => result.current.toggleAsset("d1"));
    act(() => result.current.toggleScript("s1"));
    act(() => result.current.toggleScriptDetails("s1"));
    expect(result.current.assets.size + result.current.scripts.size + result.current.expandedScripts.size).toBe(0);
  });

  it("seleciona o segmento inteiro e depois remove quando todos já estavam marcados", () => {
    const { result } = renderHook(() => usePreventiveSelection());

    act(() => result.current.toggleAsset("d1"));
    act(() => result.current.toggleSegment(["d1", "d2", "d3"]));
    expect([...result.current.assets].sort()).toEqual(["d1", "d2", "d3"]);

    act(() => result.current.toggleSegment(["d1", "d2", "d3"]));
    expect(result.current.assets.size).toBe(0);
  });

  it("limpa a seleção mantendo ou descartando as descrições expandidas", () => {
    const { result } = renderHook(() => usePreventiveSelection());

    act(() => result.current.toggleAsset("d1"));
    act(() => result.current.toggleScript("s1"));
    act(() => result.current.toggleScriptDetails("s1"));
    act(() => result.current.clearSelection());
    expect(result.current.assets.size + result.current.scripts.size).toBe(0);
    expect(result.current.expandedScripts.size).toBe(1);

    act(() => result.current.clearAll());
    expect(result.current.expandedScripts.size).toBe(0);
  });
});
