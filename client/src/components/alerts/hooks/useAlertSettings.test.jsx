import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultPriorityColors, normalizePrioritySettings } from "../alertUtils.js";
import useAlertSettings from "./useAlertSettings.js";

const settings = normalizePrioritySettings();

function setup(overrides = {}) {
  const props = {
    alertPrioritySettings: settings,
    onSaveAlertPrioritySettings: vi.fn().mockImplementation(async (value) => value),
    ...overrides
  };
  const hook = renderHook((current) => useAlertSettings(current), { initialProps: props });
  return { ...hook, props };
}

describe("useAlertSettings", () => {
  it("começa fechado com as seções recolhidas e o rascunho normalizado", () => {
    const { result } = setup();

    expect(result.current.settingsOpen).toBe(false);
    expect(result.current.sectionsOpen).toEqual({ rules: false, priority: false, scripts: false });
    expect(result.current.priorityDraft).toEqual(settings);
  });

  it("alterna seções e recolhe tudo ao reabrir o modal", () => {
    const { result } = setup();

    act(() => result.current.openSettings());
    act(() => result.current.toggleSection("rules"));
    act(() => result.current.toggleColorsOpen());
    expect(result.current.sectionsOpen.rules).toBe(true);
    expect(result.current.priorityColorsOpen).toBe(true);

    act(() => result.current.closeSettings());
    act(() => result.current.openSettings());
    expect(result.current.sectionsOpen).toEqual({ rules: false, priority: false, scripts: false });
    expect(result.current.priorityColorsOpen).toBe(false);
  });

  it("edita janelas operacionais, prioridades e cores no rascunho", () => {
    const { result } = setup();

    act(() => result.current.updateOperationalDraft("preventiveDueDays", "90"));
    act(() => result.current.updatePriorityDraft("autoPriority", "enabled", true));
    act(() => result.current.changeColor("high", "#123456"));

    expect(result.current.priorityDraft.preventiveDueDays).toBe("90");
    expect(result.current.priorityDraft.autoPriority.enabled).toBe(true);
    expect(result.current.priorityDraft.priorityColors.high).toBe("#123456");

    act(() => result.current.resetColors());
    expect(result.current.priorityDraft.priorityColors).toEqual(defaultPriorityColors);
  });

  it("ressincroniza o rascunho quando as configurações do servidor mudam", () => {
    const { result, rerender, props } = setup();

    act(() => result.current.updateOperationalDraft("preventiveDueDays", "90"));
    rerender({ ...props, alertPrioritySettings: normalizePrioritySettings({ preventiveDueDays: 45 }) });

    expect(result.current.priorityDraft.preventiveDueDays).toBe(45);
  });

  it("salva o rascunho normalizado e adota a resposta do servidor", async () => {
    const onSave = vi.fn().mockResolvedValue({ ...settings, preventiveDueDays: 7 });
    const { result } = setup({ onSaveAlertPrioritySettings: onSave });

    act(() => result.current.updateOperationalDraft("scriptValidationWindowMinutes", "1"));
    await act(async () => result.current.save());

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ scriptValidationWindowMinutes: 5 }));
    expect(result.current.priorityDraft.preventiveDueDays).toBe(7);
    expect(result.current.prioritySaving).toBe(false);
  });

  it("usa o rascunho normalizado quando o servidor não devolve nada", async () => {
    const { result } = setup({ onSaveAlertPrioritySettings: vi.fn().mockResolvedValue(undefined) });

    act(() => result.current.updateOperationalDraft("rejectedAlertSilenceHours", "0"));
    await act(async () => result.current.save());

    expect(result.current.priorityDraft.rejectedAlertSilenceHours).toBe(1);
  });

  it("não salva sem handler e libera o estado quando o salvamento falha", async () => {
    const semHandler = setup({ onSaveAlertPrioritySettings: undefined });
    await act(async () => semHandler.result.current.save());
    expect(semHandler.result.current.prioritySaving).toBe(false);

    const falha = setup({ onSaveAlertPrioritySettings: vi.fn().mockRejectedValue(new Error("falhou")) });
    await act(async () => {
      await falha.result.current.save().catch(() => {});
    });
    expect(falha.result.current.prioritySaving).toBe(false);
  });
});
