import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useAutomationMachineDetails from "./useAutomationMachineDetails.js";

const planA = { id: "pa", planName: "A", recurrenceType: "monthly", assetCount: 2 };
const planB = { id: "pb", planName: "B", recurrenceType: "weekly", assetCount: 1 };
const machine = { assetId: "d1", assetName: "PC-01", plans: [planA, planB] };
const detail = {
  override: { active: true, recurrenceType: "weekly", preferredTime: "10:00" },
  schedule: { recurrenceType: "weekly" },
  plan: planA
};

function setup(overrides = {}) {
  const props = {
    machine,
    open: true,
    saving: false,
    onClose: vi.fn(),
    onSaveOverride: vi.fn().mockResolvedValue(undefined),
    onRemoveOverride: vi.fn().mockResolvedValue(undefined),
    onLoadDetails: vi.fn().mockResolvedValue(detail),
    ...overrides
  };
  const hook = renderHook((current) => useAutomationMachineDetails(current), { initialProps: props });
  return { ...hook, props };
}

const submitEvent = () => ({ preventDefault: vi.fn() });

describe("useAutomationMachineDetails", () => {
  it("seleciona o primeiro plano e carrega os detalhes", async () => {
    const { result, props } = setup();

    expect(result.current.selectedPlan).toBe(planA);
    expect(result.current.detailLoading).toBe(true);
    await waitFor(() => expect(result.current.detail).toBe(detail));
    expect(props.onLoadDetails).toHaveBeenCalledWith("pa", "d1");
    expect(result.current.detailLoading).toBe(false);
    expect(result.current.overrideDraft).toMatchObject({ recurrenceType: "weekly", preferredTime: "10:00" });
    expect(result.current.view.hasCustomOverride).toBe(true);
  });

  it("expõe o erro de carregamento com mensagem padrão", async () => {
    const { result } = setup({ onLoadDetails: vi.fn().mockRejectedValue({}) });

    await waitFor(() => expect(result.current.detailError).toBe("Não foi possível carregar os detalhes desta máquina."));
    expect(result.current.detailLoading).toBe(false);
  });

  it("não tenta carregar sem a função de carga ou com o modal fechado", () => {
    const semCarga = setup({ onLoadDetails: undefined });
    expect(semCarga.result.current.detailLoading).toBe(false);

    const fechado = setup({ open: false });
    expect(fechado.props.onLoadDetails).not.toHaveBeenCalled();
  });

  it("ignora a resposta de um carregamento cancelado", async () => {
    let resolveFirst;
    const onLoadDetails = vi
      .fn()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      )
      .mockResolvedValueOnce({ ...detail, history: [{ id: "segundo" }] });
    const { result } = setup({ onLoadDetails });

    act(() => result.current.switchPlan("pb"));
    await waitFor(() => expect(result.current.detail?.history).toEqual([{ id: "segundo" }]));
    await act(async () => resolveFirst({ ...detail, history: [{ id: "primeiro" }] }));

    expect(result.current.detail.history).toEqual([{ id: "segundo" }]);
  });

  it("troca de plano e recarrega os detalhes", async () => {
    const { result, props } = setup();

    await waitFor(() => expect(result.current.detailLoading).toBe(false));
    act(() => result.current.switchPlan("pb"));

    expect(result.current.selectedPlan).toBe(planB);
    await waitFor(() => expect(props.onLoadDetails).toHaveBeenCalledWith("pb", "d1"));
  });

  it("valida e salva a recorrência, atualizando o painel com a resposta", async () => {
    const response = { ...detail, history: [{ id: "novo" }] };
    const onSaveOverride = vi.fn().mockResolvedValue(response);
    const { result } = setup({ onSaveOverride });

    await waitFor(() => expect(result.current.detailLoading).toBe(false));
    act(() => result.current.startEditingOverride());
    act(() => result.current.updateOverride("recurrenceType", "custom_days"));
    act(() => result.current.updateOverride("recurrenceIntervalDays", 0));
    await act(async () => result.current.submitOverride(submitEvent()));
    expect(onSaveOverride).not.toHaveBeenCalled();
    expect(result.current.overrideErrors.recurrenceIntervalDays).toBeDefined();

    act(() => result.current.updateOverride("recurrenceIntervalDays", 20));
    expect(result.current.overrideErrors.recurrenceIntervalDays).toBeUndefined();
    await act(async () => result.current.submitOverride(submitEvent()));

    expect(onSaveOverride).toHaveBeenCalledWith(
      "pa",
      "d1",
      expect.objectContaining({ recurrenceType: "custom_days", recurrenceIntervalDays: 20 })
    );
    expect(result.current.detail).toBe(response);
    expect(result.current.editingOverride).toBe(false);
  });

  it("remove a recorrência personalizada e sai da edição mesmo sem resposta", async () => {
    const { result, props } = setup();

    await waitFor(() => expect(result.current.detailLoading).toBe(false));
    act(() => result.current.startEditingOverride());
    await act(async () => result.current.removeOverride());

    expect(props.onRemoveOverride).toHaveBeenCalledWith("pa", "d1");
    expect(result.current.editingOverride).toBe(false);
    expect(result.current.busy).toBe(false);
  });

  it("não grava enquanto outra gravação está em andamento", async () => {
    const { result, props } = setup({ saving: true });

    await waitFor(() => expect(result.current.detailLoading).toBe(false));
    await act(async () => result.current.removeOverride());
    await act(async () => result.current.submitOverride(submitEvent()));

    expect(props.onRemoveOverride).not.toHaveBeenCalled();
    expect(props.onSaveOverride).not.toHaveBeenCalled();
  });

  it("protege alterações pendentes ao cancelar, fechar e trocar de plano", async () => {
    const { result, props } = setup();

    await waitFor(() => expect(result.current.detailLoading).toBe(false));
    act(() => result.current.startEditingOverride());
    act(() => result.current.updateOverride("preferredTime", "23:00"));

    act(() => result.current.switchPlan("pb"));
    expect(result.current.selectedPlan).toBe(planA);
    expect(result.current.unsavedChanges.confirmationOpen).toBe(true);
    act(() => result.current.unsavedChanges.continueEditing());

    act(() => result.current.requestClose());
    expect(props.onClose).not.toHaveBeenCalled();
    act(() => result.current.unsavedChanges.continueEditing());

    act(() => result.current.cancelOverrideEditing());
    act(() => result.current.unsavedChanges.discardChanges());
    expect(result.current.editingOverride).toBe(false);
    expect(result.current.overrideDraft.preferredTime).toBe("10:00");
  });

  it("reinicia a seleção ao trocar de máquina", async () => {
    const { result, rerender, props } = setup();
    const other = { assetId: "d2", assetName: "PC-02", plans: [planB] };

    await waitFor(() => expect(result.current.detailLoading).toBe(false));
    act(() => result.current.setConfirmingRemoval(true));
    rerender({ ...props, machine: other });

    await waitFor(() => expect(result.current.selectedPlan).toBe(planB));
    expect(result.current.confirmingRemoval).toBe(false);
  });

  it("não calcula a visão sem plano selecionado", () => {
    const { result } = setup({ machine: null, open: false });

    expect(result.current.selectedPlan).toBeUndefined();
    expect(result.current.view).toBeNull();
  });
});
