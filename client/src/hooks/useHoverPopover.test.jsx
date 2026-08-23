import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useHoverPopover } from "./useHoverPopover.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useHoverPopover", () => {
  it("comeca fechado e abre imediatamente ao chamar openNow", () => {
    const { result } = renderHook(() => useHoverPopover());
    expect(result.current.open).toBe(false);

    act(() => result.current.openNow());
    expect(result.current.open).toBe(true);
  });

  it("scheduleClose (via onMouseLeave do gatilho) fecha somente apos o delay", () => {
    const { result } = renderHook(() => useHoverPopover({ closeDelayMs: 250 }));

    act(() => result.current.openNow());
    act(() => result.current.triggerProps.onMouseLeave());
    expect(result.current.open).toBe(true);

    act(() => vi.advanceTimersByTime(249));
    expect(result.current.open).toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.open).toBe(false);
  });

  it("reentrar no popover antes do delay expirar cancela o fechamento", () => {
    const { result } = renderHook(() => useHoverPopover({ closeDelayMs: 250 }));

    act(() => result.current.openNow());
    act(() => result.current.triggerProps.onMouseLeave());
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.popoverProps.onMouseEnter());
    act(() => vi.advanceTimersByTime(200));

    expect(result.current.open).toBe(true);
  });

  it("closeNow fecha imediatamente, sem esperar o delay", () => {
    const { result } = renderHook(() => useHoverPopover());
    act(() => result.current.openNow());
    act(() => result.current.closeNow());
    expect(result.current.open).toBe(false);
  });

  it("toggle alterna entre aberto e fechado", () => {
    const { result } = renderHook(() => useHoverPopover());
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
  });

  it("limpa o timeout pendente ao desmontar (sem throw)", () => {
    const { result, unmount } = renderHook(() => useHoverPopover());
    act(() => result.current.openNow());
    act(() => result.current.triggerProps.onMouseLeave());
    expect(() => unmount()).not.toThrow();
  });
});
