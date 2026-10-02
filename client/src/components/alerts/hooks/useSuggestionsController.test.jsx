import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createAlertLookups } from "../alertLookups.js";
import useSuggestionsController from "./useSuggestionsController.js";

const api = vi.hoisted(() => ({ fetchSuggestionRecommendedScripts: vi.fn() }));
vi.mock("../../../api.js", () => api);

const devices = [{ id: "d1", name: "PC-01" }];
const validation = { id: "v1", status: "observed_persistent", scriptName: "Limpar", log: { id: "l1" } };
const suggestions = [
  { id: "a", status: "pending", assetId: "d1", alertType: "cpu_high", createdAt: "2026-05-01T00:00:00.000Z", latestValidation: validation }
];

function setup() {
  api.fetchSuggestionRecommendedScripts.mockResolvedValue({ recommended: [], others: [] });
  const center = {
    suggestions,
    suggestionStatusFilter: "all",
    onAcceptSuggestion: vi.fn(),
    onRejectSuggestion: vi.fn(),
    onUseSuggestionScript: vi.fn(),
    onApplyScriptLogSuggestedSolution: vi.fn(),
    onAcknowledgeScriptLog: vi.fn(),
    onCancelScriptValidation: vi.fn()
  };
  const hook = renderHook(() => useSuggestionsController({
    center,
    token: "tok",
    devices,
    lookups: createAlertLookups({ devices }),
    alertCorrelations: [],
    activeScripts: [],
    validationWindowMinutes: 30
  }));
  return { ...hook, center };
}

describe("useSuggestionsController", () => {
  it("compõe lista, menu de scripts e log, repassando aceitar/recusar do contexto", () => {
    const { result, center } = setup();

    expect(result.current.visibleSuggestions).toHaveLength(1);
    expect(result.current.actions.onAccept).toBe(center.onAcceptSuggestion);
    expect(result.current.actions.onReject).toBe(center.onRejectSuggestion);
    expect(result.current.scriptMenu.openSuggestionId).toBeNull();
    expect(result.current.scriptLog.selectedScriptLog).toBeNull();
  });

  it("abrir detalhes fecha o menu de scripts aberto", async () => {
    const { result } = setup();

    await act(async () => result.current.scriptMenu.toggleMenu("a"));
    expect(result.current.scriptMenu.openSuggestionId).toBe("a");
    act(() => result.current.actions.onOpenInfo("a"));

    expect(result.current.scriptMenu.openSuggestionId).toBeNull();
    expect(result.current.selectedSuggestion.id).toBe("a");
    act(() => result.current.closeInfo());
    expect(result.current.selectedSuggestion).toBeNull();
  });

  it("abrir o log fecha o menu de scripts e seleciona o log", async () => {
    const { result } = setup();

    await act(async () => result.current.scriptMenu.toggleMenu("a"));
    act(() => result.current.actions.onOpenLog(validation));

    expect(result.current.scriptMenu.openSuggestionId).toBeNull();
    expect(result.current.scriptLog.selectedScriptLog).toMatchObject({ id: "l1", validationId: "v1" });
  });
});
