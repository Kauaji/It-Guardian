import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useScriptLogDialog from "./useScriptLogDialog.js";

const validation = (id, finishedAt, extra = {}) => ({
  id,
  status: "observed_persistent",
  scriptName: `Script ${id}`,
  finishedAt,
  log: { id: `log-${id}`, suggestedSolution: "Reiniciar" },
  ...extra
});

function setup(suggestions = [], overrides = {}) {
  const props = {
    suggestions,
    onApplyScriptLogSuggestedSolution: vi.fn().mockResolvedValue(undefined),
    onAcknowledgeScriptLog: vi.fn().mockResolvedValue(undefined),
    onCancelScriptValidation: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
  return { ...renderHook((current) => useScriptLogDialog(current), { initialProps: props }), props };
}

afterEach(() => vi.restoreAllMocks());

describe("useScriptLogDialog - abertura", () => {
  it("abre o log de uma validação combinando os dados", () => {
    const { result } = setup();

    act(() => result.current.openFromValidation(validation("1", "2026-05-01")));

    expect(result.current.selectedScriptLog).toMatchObject({ id: "log-1", scriptName: "Script 1", validationStatus: "observed_persistent", validationId: "1" });
  });

  it("abre o log mais recente entre as sugestões, usando as datas de contingência", () => {
    const { result } = setup([
      { id: "a", latestValidation: validation("antigo", "2026-05-01") },
      { id: "b", latestValidation: validation("novo", undefined, { job: { completedAt: "2026-06-01" } }) },
      { id: "c", latestValidation: { id: "sem-log", finishedAt: "2027-01-01" } },
      { id: "d" }
    ]);

    act(() => result.current.openLatestLog());

    expect(result.current.selectedScriptLog.validationId).toBe("novo");
  });

  it("avisa quando não há nenhum log disponível", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = setup([{ id: "a" }]);

    act(() => result.current.openLatestLog());

    expect(alertSpy).toHaveBeenCalledWith("Nenhum log de script disponível.");
    expect(result.current.selectedScriptLog).toBeNull();
  });

  it("fecha sem limpar as notas digitadas", () => {
    const { result } = setup();

    act(() => result.current.openFromValidation(validation("1")));
    act(() => result.current.setCustomNotes("minhas notas"));
    act(() => result.current.close());

    expect(result.current.selectedScriptLog).toBeNull();
    expect(result.current.customNotes).toBe("minhas notas");
  });
});

describe("useScriptLogDialog - ações", () => {
  async function openLog(hook) {
    act(() => hook.result.current.openFromValidation(validation("1")));
  }

  it("registra a solução sugerida somente após confirmar", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const hook = setup();
    await openLog(hook);

    await act(async () => hook.result.current.registerSuggestedSolution());
    expect(hook.props.onApplyScriptLogSuggestedSolution).not.toHaveBeenCalled();
    expect(hook.result.current.selectedScriptLog).not.toBeNull();

    await act(async () => hook.result.current.registerSuggestedSolution());
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(hook.props.onApplyScriptLogSuggestedSolution).toHaveBeenCalledWith("log-1", { notes: "Reiniciar" });
    expect(hook.result.current.selectedScriptLog).toBeNull();
  });

  it("usa a nota padrão quando o log não traz solução sugerida", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const hook = setup();
    act(() => hook.result.current.openFromValidation(validation("1", undefined, { log: { id: "log-x" } })));

    await act(async () => hook.result.current.registerSuggestedSolution());

    expect(hook.props.onApplyScriptLogSuggestedSolution).toHaveBeenCalledWith("log-x", { notes: "Solução sugerida registrada para acompanhamento." });
  });

  it("registra solução própria com as notas ou com o texto padrão e limpa tudo", async () => {
    const hook = setup();
    await openLog(hook);
    act(() => hook.result.current.setCustomNotes("  Fiz X  "));
    await act(async () => hook.result.current.registerCustomSolution());
    expect(hook.props.onApplyScriptLogSuggestedSolution).toHaveBeenLastCalledWith("log-1", { notes: "Fiz X" });
    expect(hook.result.current.customNotes).toBe("");

    await openLog(hook);
    await act(async () => hook.result.current.registerCustomSolution());
    expect(hook.props.onApplyScriptLogSuggestedSolution).toHaveBeenLastCalledWith("log-1", { notes: "Solução própria registrada pelo técnico." });
  });

  it("marca como analisado", async () => {
    const hook = setup();
    await openLog(hook);

    await act(async () => hook.result.current.acknowledge());

    expect(hook.props.onAcknowledgeScriptLog).toHaveBeenCalledWith("log-1");
    expect(hook.result.current.selectedScriptLog).toBeNull();
  });

  it("cancela a análise pela validação e, sem ela, apenas marca como analisado", async () => {
    const hook = setup();
    await openLog(hook);
    await act(async () => hook.result.current.cancelAnalysis());
    expect(hook.props.onCancelScriptValidation).toHaveBeenCalledWith("1");

    act(() => hook.result.current.openFromValidation({ id: undefined, log: { id: "log-2" } }));
    await act(async () => hook.result.current.cancelAnalysis());
    expect(hook.props.onAcknowledgeScriptLog).toHaveBeenCalledWith("log-2");

    const semHandler = setup([], { onCancelScriptValidation: undefined });
    await openLog(semHandler);
    await act(async () => semHandler.result.current.cancelAnalysis());
    expect(semHandler.props.onAcknowledgeScriptLog).toHaveBeenCalledWith("log-1");
  });
});
