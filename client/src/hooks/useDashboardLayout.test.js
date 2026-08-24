import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../api.js", () => ({
  fetchDashboardLayout: vi.fn(),
  saveDashboardLayout: vi.fn(),
  resetDashboardLayout: vi.fn()
}));

import { fetchDashboardLayout, resetDashboardLayout, saveDashboardLayout } from "../api.js";
import { useDashboardLayout } from "./useDashboardLayout.js";

afterEach(() => {
  vi.clearAllMocks();
});

describe("useDashboardLayout", () => {
  it("carrega o layout ao montar quando token e canView estao presentes", async () => {
    fetchDashboardLayout.mockResolvedValue({ widgets: [{ id: "w1" }] });

    const { result } = renderHook(() => useDashboardLayout({ token: "tok", canView: true }));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.layout).toEqual({ widgets: [{ id: "w1" }] });
    expect(result.current.error).toBe("");
  });

  it("nao busca nada sem permissao de visualizar", async () => {
    renderHook(() => useDashboardLayout({ token: "tok", canView: false }));
    expect(fetchDashboardLayout).not.toHaveBeenCalled();
  });

  it("expoe o erro real e notifica quando a busca falha", async () => {
    fetchDashboardLayout.mockRejectedValue(new Error("Sem permissao"));
    const notify = vi.fn();

    const { result } = renderHook(() => useDashboardLayout({ token: "tok", canView: true, notify }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Sem permissao");
    expect(notify).toHaveBeenCalledWith("Sem permissao", "danger");
  });

  it("saveLayout atualiza o estado local com o que o servidor devolveu", async () => {
    fetchDashboardLayout.mockResolvedValue({ widgets: [] });
    saveDashboardLayout.mockResolvedValue({ widgets: [{ id: "novo" }] });

    const { result } = renderHook(() => useDashboardLayout({ token: "tok", canView: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveLayout({ widgets: [{ id: "novo" }] });
    });

    expect(saveDashboardLayout).toHaveBeenCalledWith("tok", { widgets: [{ id: "novo" }] });
    expect(result.current.layout).toEqual({ widgets: [{ id: "novo" }] });
  });

  it("resetLayout atualiza o estado local para o layout padrao devolvido", async () => {
    fetchDashboardLayout.mockResolvedValue({ widgets: [{ id: "custom" }] });
    resetDashboardLayout.mockResolvedValue({ widgets: [{ id: "default-1" }, { id: "default-2" }] });

    const { result } = renderHook(() => useDashboardLayout({ token: "tok", canView: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.resetLayout();
    });

    expect(resetDashboardLayout).toHaveBeenCalledWith("tok");
    expect(result.current.layout.widgets).toHaveLength(2);
  });
});
