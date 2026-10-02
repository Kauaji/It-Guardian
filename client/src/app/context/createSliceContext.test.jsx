import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlertFiltersProvider, useAlertFilters } from "./AlertFiltersContext.jsx";
import { createSliceContext } from "./createSliceContext.jsx";
import { useInventory } from "./workspaceContexts.js";

describe("createSliceContext", () => {
  it("entrega o valor do provedor ao hook de leitura", () => {
    const [Provider, useSlice] = createSliceContext("useExemplo");
    const { result } = renderHook(() => useSlice(), {
      wrapper: ({ children }) => <Provider value={{ ok: true }}>{children}</Provider>
    });
    expect(result.current).toEqual({ ok: true });
  });

  it("falha com mensagem clara fora do provedor", () => {
    const [, useSlice] = createSliceContext("useExemplo");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSlice())).toThrow("useExemplo precisa ser usado dentro do WorkspaceProvider.");
    expect(() => renderHook(() => useInventory())).toThrow("useInventory precisa ser usado");
  });
});

describe("AlertFiltersProvider", () => {
  function Probe() {
    const filters = useAlertFilters();
    return (
      <button onClick={() => filters.setStatusFilter("resolved")}>
        {filters.severityFilter}/{filters.statusFilter}/{filters.suggestionStatusFilter}
      </button>
    );
  }

  it("comeca com todos os filtros em 'all' e guarda as alteracoes", () => {
    render(
      <AlertFiltersProvider>
        <Probe />
      </AlertFiltersProvider>
    );
    expect(screen.getByRole("button")).toHaveTextContent("all/all/all");
    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("button")).toHaveTextContent("all/resolved/all");
  });

  it("exige o provedor", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAlertFilters())).toThrow("useAlertFilters precisa ser usado");
  });
});
