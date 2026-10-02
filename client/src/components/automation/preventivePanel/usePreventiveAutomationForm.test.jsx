import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import usePreventiveAutomationForm from "./usePreventiveAutomationForm.js";

function setup(overrides = {}) {
  const props = {
    plans: [{ id: "p1", name: "Existente", indicatorColor: "#2563eb", recurrenceType: "weekly" }],
    onSave: vi.fn().mockResolvedValue(undefined),
    onCreateAutomatedPreventivePlan: undefined,
    createRequest: null,
    onCreateRequestHandled: vi.fn(),
    ...overrides
  };
  const hook = renderHook((current) => usePreventiveAutomationForm(current), { initialProps: props });
  return { ...hook, props };
}

const submitEvent = () => ({ preventDefault: vi.fn() });

describe("usePreventiveAutomationForm", () => {
  it("abre o modal de criação com o formulário vazio", () => {
    const { result } = setup();

    act(() => result.current.openCreateModal());

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.form.id).toBeNull();
    expect(result.current.wizardMode).toBe(false);
    expect(result.current.overridesOpen).toBe(false);
  });

  it("abre o modal de edição com os dados do plano", () => {
    const { result } = setup();

    act(() => result.current.openEditModal({ id: "p1", name: "Existente", recurrenceType: "weekly", scopeType: "segment", scopeId: "s1" }));

    expect(result.current.form).toMatchObject({ id: "p1", name: "Existente", scopeType: "segment", scopeId: "s1" });
    expect(result.current.wizardMode).toBe(false);
  });

  it("atualiza campos, alterna scripts e mantém dependências de escopo", () => {
    const { result } = setup();

    act(() => result.current.openCreateModal());
    act(() => result.current.updateForm("scopeType", "segment"));
    act(() => result.current.updateForm("scopeId", "s1"));
    act(() => result.current.updateForm("scopeType", "group"));
    act(() => result.current.toggleScript("sc1"));
    act(() => result.current.toggleScript("sc2"));
    act(() => result.current.toggleScript("sc1"));

    expect(result.current.form.scopeId).toBe("");
    expect(result.current.form.defaultScriptIds).toEqual(["sc2"]);
  });

  it("adiciona e remove exceções de recorrência", () => {
    const { result } = setup();

    act(() => result.current.openCreateModal());
    act(() => result.current.addOverride());
    expect(result.current.form.overrides).toEqual([]);

    act(() => result.current.setOverrideDraft((draft) => ({ ...draft, targetId: "s1" })));
    act(() => result.current.addOverride());
    expect(result.current.form.overrides).toHaveLength(1);
    expect(result.current.overrideDraft.targetId).toBe("");

    act(() => result.current.removeOverride(0));
    expect(result.current.form.overrides).toEqual([]);
  });

  it("bloqueia o envio com nome duplicado", async () => {
    const { result, props } = setup();

    act(() => result.current.openCreateModal());
    act(() => result.current.updateForm("name", "existente"));
    await act(async () => result.current.submitForm(submitEvent()));

    expect(result.current.identity.hasDuplicateAutomationIdentity).toBe(true);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("bloqueia o envio com intervalo personalizado inválido", async () => {
    const { result, props } = setup();

    act(() => result.current.openCreateModal());
    act(() => result.current.updateForm("name", "Novo"));
    act(() => result.current.updateForm("recurrenceType", "custom_days"));
    act(() => result.current.updateForm("recurrenceInterval", "0"));
    await act(async () => result.current.submitForm(submitEvent()));

    expect(props.onSave).not.toHaveBeenCalled();
    expect(result.current.modalOpen).toBe(true);
  });

  it("salva um plano novo e fecha o modal", async () => {
    const { result, props } = setup();

    act(() => result.current.openCreateModal());
    act(() => result.current.updateForm("name", "Novo plano"));
    const event = submitEvent();
    await act(async () => result.current.submitForm(event));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(props.onSave).toHaveBeenCalledWith(null, expect.objectContaining({ name: "Novo plano", scopeId: null }));
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.saving).toBe(false);
  });

  it("não envia quando não há nenhum handler de gravação", async () => {
    const { result } = setup({ onSave: undefined });

    act(() => result.current.openCreateModal());
    act(() => result.current.updateForm("name", "Novo"));
    await act(async () => result.current.submitForm(submitEvent()));

    expect(result.current.modalOpen).toBe(true);
  });

  it("mantém o modal aberto e libera o estado de salvando quando a gravação falha", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("falhou"));
    const { result } = setup({ onSave });

    act(() => result.current.openCreateModal());
    act(() => result.current.updateForm("name", "Novo"));
    await act(async () => {
      await result.current.submitForm(submitEvent()).catch(() => {});
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.saving).toBe(false);
  });

  describe("assistente a partir da aba Preventivas", () => {
    const request = {
      id: 7,
      defaults: { name: "Rotina", scopeType: "asset_list", assetIds: ["d1"], defaultScriptIds: ["sc1"], context: { assetCount: 1 } }
    };

    it("abre o assistente ao receber uma solicitação, uma única vez", () => {
      const onCreateRequestHandled = vi.fn();
      const { result, rerender, props } = setup({ createRequest: request, onCreateRequestHandled });

      expect(result.current.modalOpen).toBe(true);
      expect(result.current.wizardMode).toBe(true);
      expect(result.current.wizardContext).toEqual({ assetCount: 1 });
      expect(result.current.form).toMatchObject({ name: "Rotina", assetIds: ["d1"], defaultScriptIds: ["sc1"] });
      expect(onCreateRequestHandled).toHaveBeenCalledWith(7);

      rerender({ ...props, createRequest: { ...request } });
      expect(onCreateRequestHandled).toHaveBeenCalledTimes(1);
    });

    it("passa pela revisão antes de gravar e envia o contexto ao fluxo automatizado", async () => {
      const onCreateAutomatedPreventivePlan = vi.fn().mockResolvedValue(undefined);
      const { result, props } = setup({ createRequest: request, onCreateAutomatedPreventivePlan });

      await act(async () => result.current.submitForm(submitEvent()));
      expect(result.current.reviewMode).toBe(true);
      expect(onCreateAutomatedPreventivePlan).not.toHaveBeenCalled();

      await act(async () => result.current.submitForm(submitEvent()));
      expect(onCreateAutomatedPreventivePlan).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Rotina", scopeType: "asset_list", assetIds: ["d1"] }),
        { assetCount: 1 }
      );
      expect(props.onSave).not.toHaveBeenCalled();
      expect(result.current.modalOpen).toBe(false);
      expect(result.current.reviewMode).toBe(false);
    });

    it("permite voltar da revisão e preserva o rascunho em um novo pedido", () => {
      const { result } = setup({ createRequest: request });

      act(() => result.current.setReviewMode(true));
      act(() => result.current.setReviewMode(false));
      act(() => result.current.updateForm("notes", "minhas notas"));
      act(() => result.current.openCreateModal({ name: "Outra" }, { wizard: true }));

      expect(result.current.form).toMatchObject({ name: "Outra", notes: "minhas notas" });
    });
  });

  it("fecha o modal", () => {
    const { result } = setup();

    act(() => result.current.openCreateModal());
    act(() => result.current.closeModal());

    expect(result.current.modalOpen).toBe(false);
  });
});
