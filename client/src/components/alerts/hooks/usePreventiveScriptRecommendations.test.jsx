import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import usePreventiveScriptRecommendations from "./usePreventiveScriptRecommendations.js";

const api = vi.hoisted(() => ({ fetchMaintenanceScriptRecommendations: vi.fn() }));
vi.mock("../../../api.js", () => api);

const activeScripts = [{ id: "s1" }];

beforeEach(() => api.fetchMaintenanceScriptRecommendations.mockReset());

describe("usePreventiveScriptRecommendations", () => {
  it("fica vazio sem token ou sem máquinas selecionadas", () => {
    const semToken = renderHook(() => usePreventiveScriptRecommendations({ token: "", assetIds: ["d1"], activeScripts }));
    const semMaquinas = renderHook(() => usePreventiveScriptRecommendations({ token: "t", assetIds: [], activeScripts }));

    expect(semToken.result.current[0]).toEqual({ recommended: [], others: [], loading: false, error: "" });
    expect(semMaquinas.result.current[0].loading).toBe(false);
    expect(api.fetchMaintenanceScriptRecommendations).not.toHaveBeenCalled();
  });

  it("busca as recomendações das máquinas selecionadas", async () => {
    api.fetchMaintenanceScriptRecommendations.mockResolvedValue({ recommended: [{ id: "r" }], others: [{ id: "o" }] });
    const { result } = renderHook(() => usePreventiveScriptRecommendations({ token: "t", assetIds: ["d1", "d2"], activeScripts }));

    expect(result.current[0].loading).toBe(true);
    await waitFor(() => expect(result.current[0].recommended).toEqual([{ id: "r" }]));
    expect(result.current[0]).toMatchObject({ others: [{ id: "o" }], loading: false, error: "" });
    expect(api.fetchMaintenanceScriptRecommendations).toHaveBeenCalledWith("t", {
      assetIds: ["d1", "d2"],
      context: { source: "preventive_plan" }
    });
  });

  it("trata resposta vazia e usa os scripts ativos com mensagem em caso de erro", async () => {
    api.fetchMaintenanceScriptRecommendations.mockResolvedValueOnce(undefined);
    const vazio = renderHook(() => usePreventiveScriptRecommendations({ token: "t", assetIds: ["d1"], activeScripts }));
    await waitFor(() => expect(vazio.result.current[0].loading).toBe(false));
    expect(vazio.result.current[0]).toMatchObject({ recommended: [], others: [] });

    api.fetchMaintenanceScriptRecommendations.mockRejectedValueOnce(new Error("Sem rede"));
    const erro = renderHook(() => usePreventiveScriptRecommendations({ token: "t", assetIds: ["d9"], activeScripts }));
    await waitFor(() => expect(erro.result.current[0].error).toBe("Sem rede"));
    expect(erro.result.current[0].others).toBe(activeScripts);

    api.fetchMaintenanceScriptRecommendations.mockRejectedValueOnce({});
    const padrao = renderHook(() => usePreventiveScriptRecommendations({ token: "t", assetIds: ["d8"], activeScripts }));
    await waitFor(() => expect(padrao.result.current[0].error).toBe("Não foi possível carregar recomendações."));
  });

  it("limpa o estado ao desmarcar as máquinas e permite redefinir manualmente", async () => {
    api.fetchMaintenanceScriptRecommendations.mockResolvedValue({ recommended: [{ id: "r" }], others: [] });
    const { result, rerender } = renderHook((props) => usePreventiveScriptRecommendations(props), {
      initialProps: { token: "t", assetIds: ["d1"], activeScripts }
    });

    await waitFor(() => expect(result.current[0].recommended).toHaveLength(1));
    rerender({ token: "t", assetIds: [], activeScripts });
    await waitFor(() => expect(result.current[0].recommended).toEqual([]));

    rerender({ token: "t", assetIds: ["d1"], activeScripts });
    await waitFor(() => expect(result.current[0].recommended).toHaveLength(1));
    act(() => result.current[1]());
    expect(result.current[0]).toEqual({ recommended: [], others: [], loading: false, error: "" });
  });

  it("ignora a resposta de uma busca superada por uma seleção mais nova", async () => {
    let resolveFirst;
    api.fetchMaintenanceScriptRecommendations
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      )
      .mockResolvedValueOnce({ recommended: [{ id: "segunda" }], others: [] });
    const { result, rerender } = renderHook((props) => usePreventiveScriptRecommendations(props), {
      initialProps: { token: "t", assetIds: ["d1"], activeScripts }
    });

    rerender({ token: "t", assetIds: ["d1", "d2"], activeScripts });
    await waitFor(() => expect(result.current[0].recommended).toEqual([{ id: "segunda" }]));
    await act(async () => resolveFirst({ recommended: [{ id: "primeira" }], others: [] }));

    expect(result.current[0].recommended).toEqual([{ id: "segunda" }]);
  });
});
