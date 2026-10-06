import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useAutomationPlanDetails from "./useAutomationPlanDetails.js";

const plan = {
  id: "p1",
  name: "Limpeza",
  active: true,
  recurrenceType: "monthly",
  preferredTime: "09:00",
  timezone: "UTC",
  indicatorColor: "#2563eb",
  defaultScriptIds: ["sc1"]
};
const scripts = [
  { id: "sc1", name: "A" },
  { id: "sc2", name: "B" }
];

function setup(overrides = {}) {
  const props = {
    plan,
    scripts,
    open: true,
    saving: false,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onPausePlan: vi.fn().mockResolvedValue(undefined),
    onReactivatePlan: vi.fn().mockResolvedValue(undefined),
    onLoadHistory: vi.fn().mockResolvedValue({ items: [] }),
    ...overrides
  };
  const hook = renderHook((current) => useAutomationPlanDetails(current), { initialProps: props });
  return { ...hook, props };
}

const submitEvent = () => ({ preventDefault: vi.fn() });

describe("useAutomationPlanDetails", () => {
  it("começa no resumo com os scripts vinculados do rascunho", () => {
    const { result } = setup();

    expect(result.current.activeTab).toBe("summary");
    expect(result.current.editing).toBe(false);
    expect(result.current.linkedScripts).toEqual([scripts[0]]);
    expect(result.current.draft.name).toBe("Limpeza");
  });

  it("edita o rascunho limpando o erro do campo alterado e alternando scripts", async () => {
    const { result } = setup();

    act(() => result.current.startEditing());
    act(() => result.current.updateDraft("name", ""));
    await act(async () => result.current.submit(submitEvent()));
    expect(result.current.errors.name).toBeDefined();

    act(() => result.current.updateDraft("name", "Novo nome"));
    expect(result.current.errors.name).toBeUndefined();

    act(() => result.current.toggleScript("sc2"));
    expect(result.current.draft.defaultScriptIds).toEqual(["sc1", "sc2"]);
    act(() => result.current.toggleScript("sc1"));
    expect(result.current.draft.defaultScriptIds).toEqual(["sc2"]);
  });

  it("não chama onSave com rascunho inválido", async () => {
    const { result, props } = setup();

    act(() => result.current.startEditing());
    act(() => result.current.toggleScript("sc1"));
    await act(async () => result.current.submit(submitEvent()));

    expect(props.onSave).not.toHaveBeenCalled();
    expect(result.current.errors.defaultScriptIds).toMatch(/pelo menos um script/);
  });

  it("salva usando a resposta do servidor como novo ponto de partida", async () => {
    const onSave = vi.fn().mockResolvedValue({ ...plan, name: "Salvo pelo servidor" });
    const { result } = setup({ onSave });

    act(() => result.current.startEditing());
    act(() => result.current.updateDraft("name", "Editado"));
    await act(async () => result.current.submit(submitEvent()));

    expect(onSave).toHaveBeenCalledWith("p1", expect.objectContaining({ name: "Editado" }));
    expect(result.current.editing).toBe(false);
    expect(result.current.draft.name).toBe("Salvo pelo servidor");
    expect(result.current.busy).toBe(false);
  });

  it("pede confirmação para cancelar com alterações e restaura o rascunho ao descartar", () => {
    const { result } = setup();

    act(() => result.current.startEditing());
    act(() => result.current.updateDraft("name", "Alterado"));
    act(() => result.current.cancelEditing());

    expect(result.current.unsavedChanges.confirmationOpen).toBe(true);
    expect(result.current.editing).toBe(true);
    act(() => result.current.unsavedChanges.discardChanges());
    expect(result.current.editing).toBe(false);
    expect(result.current.draft.name).toBe("Limpeza");
  });

  it("fecha direto quando não há alterações e protege o fechamento quando há", () => {
    const { result, props } = setup();

    act(() => result.current.requestClose());
    expect(props.onClose).toHaveBeenCalledTimes(1);

    act(() => result.current.startEditing());
    act(() => result.current.updateDraft("name", "Alterado"));
    act(() => result.current.requestClose());
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(result.current.unsavedChanges.confirmationOpen).toBe(true);
  });

  it("pausa o plano ativo e reativa o inativo", async () => {
    const pause = setup();
    await act(async () => pause.result.current.changeStatus());
    expect(pause.props.onPausePlan).toHaveBeenCalledWith("p1");
    expect(pause.props.onReactivatePlan).not.toHaveBeenCalled();

    const resume = setup({ plan: { ...plan, active: false } });
    act(() => resume.result.current.setConfirmingStatus(true));
    await act(async () => resume.result.current.changeStatus());
    expect(resume.props.onReactivatePlan).toHaveBeenCalledWith("p1");
    expect(resume.result.current.confirmingStatus).toBe(false);
  });

  it("ignora a mudança de status sem a ação correspondente ou durante o salvamento", async () => {
    const semAcao = setup({ onPausePlan: undefined });
    await act(async () => semAcao.result.current.changeStatus());
    expect(semAcao.result.current.busy).toBe(false);

    const salvando = setup({ saving: true });
    await act(async () => salvando.result.current.changeStatus());
    expect(salvando.props.onPausePlan).not.toHaveBeenCalled();
    expect(salvando.result.current.busy).toBe(true);
  });

  it("reinicia o estado ao trocar de plano", async () => {
    const { result, rerender, props } = setup();

    act(() => result.current.setActiveTab("agenda"));
    act(() => result.current.setConfirmingDelete(true));
    act(() => result.current.setDeleteConfirmation("Limpeza"));
    rerender({ ...props, plan: { ...plan, id: "p2", name: "Outro" } });

    await waitFor(() => expect(result.current.activeTab).toBe("summary"));
    expect(result.current.confirmingDelete).toBe(false);
    expect(result.current.deleteConfirmation).toBe("");
    expect(result.current.draft.name).toBe("Outro");
  });

  it("funciona sem plano selecionado", () => {
    const { result } = setup({ plan: null, open: false });

    expect(result.current.draft.name).toBe("");
    expect(result.current.linkedScripts).toEqual([]);
  });
});
