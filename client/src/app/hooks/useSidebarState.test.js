import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarState } from "./useSidebarState.js";

describe("useSidebarState", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("comeca recolhida e abre ao passar o mouse, fechando ao sair", () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.expanded).toBe(false);

    act(() => result.current.handleMouseEnter());
    expect(result.current.expanded).toBe(true);

    act(() => result.current.handleMouseLeave());
    expect(result.current.expanded).toBe(false);
    expect(result.current.collapsed).toBe(true);
  });

  it("alterna o recolhimento pelo botao da marca", () => {
    const { result } = renderHook(() => useSidebarState());
    act(() => result.current.toggleCollapsed());
    expect(result.current.collapsed).toBe(false);
    expect(result.current.expanded).toBe(true);
    act(() => result.current.toggleCollapsed());
    expect(result.current.collapsed).toBe(true);
  });

  it("expande durante o arraste e ignora o mouse ate o fim", () => {
    const { result } = renderHook(() => useSidebarState());
    act(() => result.current.beginDrag());
    expect(result.current.dragActive).toBe(true);
    expect(result.current.expanded).toBe(true);

    act(() => result.current.handleMouseLeave());
    expect(result.current.expanded).toBe(true);
    act(() => result.current.handleMouseEnter());
    expect(result.current.dragActive).toBe(true);
  });

  it("apos o arraste recolhe depois de 950 ms se estava recolhida antes", () => {
    const { result } = renderHook(() => useSidebarState());
    act(() => result.current.beginDrag());
    act(() => result.current.endDrag());
    expect(result.current.dragActive).toBe(false);
    expect(result.current.collapsed).toBe(false);

    act(() => vi.advanceTimersByTime(949));
    expect(result.current.collapsed).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.collapsed).toBe(true);
  });

  it("apos o arraste mantem aberta se ja estava aberta antes", () => {
    const { result } = renderHook(() => useSidebarState());
    act(() => result.current.toggleCollapsed());
    act(() => result.current.beginDrag());
    act(() => result.current.endDrag());
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.collapsed).toBe(false);
  });

  it("recolhe na hora quando o item foi solto na propria sidebar", () => {
    const { result } = renderHook(() => useSidebarState());
    act(() => result.current.handleMouseEnter());
    act(() => result.current.beginDrag());
    act(() => result.current.endDrag({ forceCollapse: true }));
    expect(result.current.collapsed).toBe(true);
    expect(result.current.expanded).toBe(false);
  });

  it("cancela o recolhimento agendado ao desmontar", () => {
    const { result, unmount } = renderHook(() => useSidebarState());
    act(() => result.current.beginDrag());
    act(() => result.current.endDrag());
    const clearSpy = vi.spyOn(window, "clearTimeout");
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
