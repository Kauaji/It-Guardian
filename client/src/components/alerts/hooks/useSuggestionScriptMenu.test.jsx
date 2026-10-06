import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useSuggestionScriptMenu from "./useSuggestionScriptMenu.js";

const api = vi.hoisted(() => ({ fetchSuggestionRecommendedScripts: vi.fn() }));
vi.mock("../../../api.js", () => api);

const activeScripts = [{ id: "s1", name: "Limpar" }];
const freshDevice = { id: "d1", source: "agent", agent: { lastSeenAt: new Date().toISOString() } };
const suggestion = { id: "sug1", assetId: "d1" };

function setup(overrides = {}) {
  const props = {
    token: "tok",
    activeScripts,
    lookups: { findSuggestionDevice: vi.fn().mockReturnValue(freshDevice) },
    validationWindowMinutes: 45,
    onUseSuggestionScript: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
  const hook = renderHook((current) => useSuggestionScriptMenu(current), { initialProps: props });
  return { ...hook, props };
}

beforeEach(() => {
  api.fetchSuggestionRecommendedScripts.mockReset();
  api.fetchSuggestionRecommendedScripts.mockResolvedValue({ recommended: [{ id: "r1" }], others: [{ id: "o1" }] });
});

afterEach(() => vi.restoreAllMocks());

describe("useSuggestionScriptMenu - menu", () => {
  it("abre o menu, carrega as recomendações e fecha ao alternar de novo", async () => {
    const { result } = setup();

    await act(async () => result.current.toggleMenu("sug1"));

    expect(result.current.openSuggestionId).toBe("sug1");
    expect(api.fetchSuggestionRecommendedScripts).toHaveBeenCalledWith("tok", "sug1");
    expect(result.current.recommendationsBySuggestion.sug1).toEqual({ recommended: [{ id: "r1" }], others: [{ id: "o1" }] });
    expect(result.current.loadingId).toBeNull();

    await act(async () => result.current.toggleMenu("sug1"));
    expect(result.current.openSuggestionId).toBeNull();
  });

  it("não recarrega recomendações já carregadas", async () => {
    const { result } = setup();

    await act(async () => result.current.toggleMenu("sug1"));
    await act(async () => result.current.toggleMenu("sug1"));
    await act(async () => result.current.toggleMenu("sug1"));

    expect(api.fetchSuggestionRecommendedScripts).toHaveBeenCalledTimes(1);
  });

  it("indica o carregamento enquanto a busca está em andamento", async () => {
    let finish;
    api.fetchSuggestionRecommendedScripts.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { result } = setup();

    act(() => {
      result.current.toggleMenu("sug1");
    });
    await waitFor(() => expect(result.current.loadingId).toBe("sug1"));
    await act(async () => finish({}));

    expect(result.current.loadingId).toBeNull();
    expect(result.current.recommendationsBySuggestion.sug1).toEqual({ recommended: [], others: [] });
  });

  it("usa os scripts ativos quando a busca falha, com erro só se não houver scripts", async () => {
    api.fetchSuggestionRecommendedScripts.mockRejectedValue(new Error("Falhou"));
    const comScripts = setup();
    await act(async () => comScripts.result.current.toggleMenu("sug1"));
    expect(comScripts.result.current.recommendationsBySuggestion.sug1).toEqual({ recommended: [], others: activeScripts, error: "" });

    const semScripts = setup({ activeScripts: [] });
    await act(async () => semScripts.result.current.toggleMenu("sug1"));
    expect(semScripts.result.current.recommendationsBySuggestion.sug1.error).toBe("Falhou");

    api.fetchSuggestionRecommendedScripts.mockRejectedValue({});
    const semMensagem = setup({ activeScripts: [] });
    await act(async () => semMensagem.result.current.toggleMenu("sug2"));
    expect(semMensagem.result.current.recommendationsBySuggestion.sug2.error).toBe("Não foi possível carregar os scripts.");
  });

  it("fecha o menu explicitamente", async () => {
    const { result } = setup();

    await act(async () => result.current.toggleMenu("sug1"));
    act(() => result.current.closeMenu());

    expect(result.current.openSuggestionId).toBeNull();
  });
});

describe("useSuggestionScriptMenu - execução", () => {
  it("envia o script para execução após a confirmação e fecha o menu", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result, props } = setup();

    await act(async () => result.current.toggleMenu("sug1"));
    await act(async () => result.current.useScript(suggestion, { id: "s1", riskLevel: "low" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(props.onUseSuggestionScript).toHaveBeenCalledWith("sug1", "s1", {
      mode: "agent",
      confirmed: true,
      riskAcknowledged: false,
      validationWindowMinutes: 45,
      notes: expect.stringContaining("Script solicitado pelo card AVISO-")
    });
    expect(result.current.openSuggestionId).toBeNull();
    expect(result.current.usingKey).toBe("");
  });

  it("pede segunda confirmação para risco alto ou crítico", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result, props } = setup();

    await act(async () => result.current.useScript(suggestion, { id: "s1", riskLevel: "critical" }));

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(props.onUseSuggestionScript).toHaveBeenCalledWith("sug1", "s1", expect.objectContaining({ riskAcknowledged: true }));
  });

  it("não executa quando alguma confirmação é recusada", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    const { result, props } = setup();
    await act(async () => result.current.useScript(suggestion, { id: "s1" }));

    vi.spyOn(window, "confirm").mockReturnValueOnce(true).mockReturnValueOnce(false);
    await act(async () => result.current.useScript(suggestion, { id: "s1", riskLevel: "high" }));

    expect(props.onUseSuggestionScript).not.toHaveBeenCalled();
  });

  it("avisa e não executa quando a máquina não tem agente ativo", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const confirm = vi.spyOn(window, "confirm");
    const { result, props } = setup({ lookups: { findSuggestionDevice: () => null } });

    await act(async () => result.current.useScript(suggestion, { id: "s1" }));

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("não possui um agente ativo"));
    expect(confirm).not.toHaveBeenCalled();
    expect(props.onUseSuggestionScript).not.toHaveBeenCalled();
  });

  it("considera o agente desatualizado como inativo", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const stale = { id: "d1", source: "agent", agent: { lastSeenAt: "2020-01-01T00:00:00.000Z" } };
    const { result } = setup({ lookups: { findSuggestionDevice: () => stale } });

    await act(async () => result.current.useScript(suggestion, { id: "s1" }));

    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it("ignora um segundo clique enquanto o mesmo script está em execução", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let finish;
    const onUseSuggestionScript = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { result } = setup({ onUseSuggestionScript });

    let first;
    act(() => {
      first = result.current.useScript(suggestion, { id: "s1" });
    });
    await waitFor(() => expect(result.current.usingKey).toBe("sug1:s1"));
    await act(async () => result.current.useScript(suggestion, { id: "s1" }));
    expect(onUseSuggestionScript).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish();
      await first;
    });
    expect(result.current.usingKey).toBe("");
  });

  it("libera o estado quando a execução falha", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = setup({ onUseSuggestionScript: vi.fn().mockRejectedValue(new Error("recusado")) });

    await act(async () => {
      await result.current.useScript(suggestion, { id: "s1" }).catch(() => {});
    });

    expect(result.current.usingKey).toBe("");
  });
});
