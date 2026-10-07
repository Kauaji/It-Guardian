import { describe, expect, it } from "vitest";
import {
  applyAutomationFormField,
  buildAutomationFormFromDefaults,
  buildAutomationFormFromPlan,
  buildAutomationPayload,
  buildEmptyAutomationForm,
  buildEmptyOverrideDraft,
  buildOverrideFromDraft,
  buildReactivationPayload,
  findDuplicateAutomationIdentity,
  formatPanelDate,
  getDefaultRecurrenceInterval,
  getOverrideLabel,
  getPlanRecurrenceIntervalDays,
  getRecurrenceLabel,
  getRecurrenceShortLabel,
  getScopeLabel,
  getScopeOptions,
  isColorUsedByOtherPlan,
  isInvalidCustomInterval,
  normalizeAutomationColor,
  resolveFormRecurrenceInterval,
  toggleListItem
} from "./preventiveAutomationPanelUtils.js";

const sources = {
  devices: [{ id: "d1", name: "PC-01", ip: "10.0.0.1" }, { id: "d2", segmentName: "Recepção" }, { id: "d3" }],
  segments: [{ id: "s1", name: "Recepção" }],
  segmentGroups: [{ id: "g1", name: "Matriz" }],
  inventoryTabs: [{ id: "t1", name: "Ambiente 1" }]
};

describe("valores padrão e normalização", () => {
  it("normaliza cores hexadecimais e usa o fallback para valores inválidos", () => {
    expect(normalizeAutomationColor("#ABCDEF")).toBe("#abcdef");
    expect(normalizeAutomationColor("  #123456  ")).toBe("#123456");
    expect(normalizeAutomationColor("azul")).toBe("#1f7a61");
    expect(normalizeAutomationColor(null, "#000000")).toBe("#000000");
  });

  it("devolve o intervalo padrão por tipo de recorrência", () => {
    expect(getDefaultRecurrenceInterval("daily")).toBe(1);
    expect(getDefaultRecurrenceInterval("weekly")).toBe(7);
    expect(getDefaultRecurrenceInterval("biweekly")).toBe(15);
    expect(getDefaultRecurrenceInterval("monthly")).toBe(30);
    expect(getDefaultRecurrenceInterval("custom_days")).toBe(30);
  });

  it("resolve os dias de recorrência do plano na ordem intervalDays, interval, padrão", () => {
    expect(getPlanRecurrenceIntervalDays({ recurrenceIntervalDays: 10, recurrenceInterval: 5 })).toBe(10);
    expect(getPlanRecurrenceIntervalDays({ recurrenceInterval: 5 })).toBe(5);
    expect(getPlanRecurrenceIntervalDays({ recurrenceType: "weekly" })).toBe(7);
    expect(getPlanRecurrenceIntervalDays(null)).toBe(30);
  });

  it("valida intervalos personalizados de 1 a 365 dias inteiros", () => {
    expect(isInvalidCustomInterval("custom_days", 0)).toBe(true);
    expect(isInvalidCustomInterval("custom_days", 366)).toBe(true);
    expect(isInvalidCustomInterval("custom_days", 1.5)).toBe(true);
    expect(isInvalidCustomInterval("custom_days", Number.NaN)).toBe(true);
    expect(isInvalidCustomInterval("custom_days", 365)).toBe(false);
    expect(isInvalidCustomInterval("monthly", 0)).toBe(false);
  });

  it("formata datas e trata ausência de valor", () => {
    expect(formatPanelDate(null)).toBe("Não informado");
    expect(formatPanelDate("2026-07-01T12:30:00.000Z")).toMatch(/^01\/07/);
  });
});

describe("construção do formulário", () => {
  it("cria formulário e rascunho de exceção vazios", () => {
    expect(buildEmptyAutomationForm()).toMatchObject({
      id: null,
      active: true,
      recurrenceType: "monthly",
      recurrenceInterval: 30,
      scopeType: "all",
      assetIds: [],
      defaultScriptIds: [],
      overrides: []
    });
    expect(buildEmptyOverrideDraft()).toEqual({
      targetType: "segment",
      targetId: "",
      recurrenceType: "monthly",
      recurrenceInterval: 30,
      preferredTime: "08:00"
    });
  });

  it("carrega um plano existente com valores padrão para campos ausentes", () => {
    const form = buildAutomationFormFromPlan({
      id: "p1",
      name: "Plano",
      indicatorColor: "x",
      assetIds: "nao-lista",
      overrides: [{ id: "o" }]
    });

    expect(form).toMatchObject({
      id: "p1",
      name: "Plano",
      description: "",
      active: true,
      recurrenceType: "monthly",
      recurrenceInterval: 30,
      preferredTime: "08:00",
      scopeType: "all",
      scopeId: "",
      assetIds: [],
      indicatorColor: "#1f7a61",
      overrides: [{ id: "o" }]
    });
    expect(buildAutomationFormFromPlan({ id: "p2", active: false }).active).toBe(false);
  });

  it("aplica padrões sobre um formulário vazio ignorando o id", () => {
    const form = buildAutomationFormFromDefaults(
      buildEmptyAutomationForm(),
      { name: "Rotina", id: "x", assetIds: ["d1"], indicatorColor: "#ABCDEF" },
      false
    );

    expect(form).toMatchObject({ id: null, name: "Rotina", assetIds: ["d1"], indicatorColor: "#abcdef", defaultScriptIds: [] });
  });

  it("preserva o rascunho do assistente apenas quando permitido e ainda sem id", () => {
    const draft = { ...buildEmptyAutomationForm(), notes: "rascunho", defaultScriptIds: ["s1"] };

    expect(buildAutomationFormFromDefaults(draft, { name: "N" }, true)).toMatchObject({
      notes: "rascunho",
      defaultScriptIds: ["s1"],
      name: "N"
    });
    expect(buildAutomationFormFromDefaults(draft, { name: "N" }, false).notes).toBe("");
    expect(buildAutomationFormFromDefaults({ ...draft, id: "p9" }, { name: "N" }, true).notes).toBe("");
  });

  it("reinicia campos dependentes ao mudar escopo e recorrência", () => {
    const current = { ...buildEmptyAutomationForm(), scopeType: "segment", scopeId: "s1", assetIds: ["d1"] };

    expect(applyAutomationFormField(current, "scopeType", "group")).toMatchObject({ scopeType: "group", scopeId: "", assetIds: [] });
    expect(applyAutomationFormField(current, "scopeType", "asset_list")).toMatchObject({ scopeId: "", assetIds: ["d1"] });
    expect(applyAutomationFormField(current, "recurrenceType", "weekly")).toMatchObject({
      recurrenceType: "weekly",
      recurrenceInterval: 7
    });
    expect(applyAutomationFormField(current, "name", "X")).toMatchObject({ name: "X", scopeId: "s1" });
  });

  it("alterna itens de uma lista sem duplicar", () => {
    expect(toggleListItem(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleListItem(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleListItem(undefined, "a")).toEqual(["a"]);
  });
});

describe("payloads", () => {
  it("usa o intervalo digitado apenas na recorrência personalizada", () => {
    expect(resolveFormRecurrenceInterval({ recurrenceType: "custom_days", recurrenceInterval: "45" })).toBe(45);
    expect(resolveFormRecurrenceInterval({ recurrenceType: "weekly", recurrenceInterval: "45" })).toBe(7);
  });

  it("monta o payload de automação anulando alvo quando o escopo é global ou lista", () => {
    const base = { ...buildEmptyAutomationForm(), name: "Plano", defaultScriptIds: ["s1"], scopeId: "s1" };

    expect(buildAutomationPayload({ ...base, scopeType: "all" })).toMatchObject({ scopeId: null, assetIds: [] });
    expect(buildAutomationPayload({ ...base, scopeType: "asset_list", assetIds: ["d1"] })).toMatchObject({
      scopeId: null,
      assetIds: ["d1"]
    });
    expect(buildAutomationPayload({ ...base, scopeType: "segment", assetIds: ["d1"] })).toMatchObject({ scopeId: "s1", assetIds: [] });
  });

  it("normaliza exceções no payload", () => {
    const payload = buildAutomationPayload({
      ...buildEmptyAutomationForm(),
      overrides: [
        { assetId: "d1", recurrenceType: "daily", active: false },
        { segmentId: "s1", recurrenceType: "custom_days", recurrenceInterval: 12, preferredTime: "10:00" }
      ]
    });

    expect(payload.overrides).toEqual([
      {
        assetId: "d1",
        segmentId: null,
        recurrenceType: "daily",
        recurrenceInterval: 30,
        recurrenceIntervalDays: 1,
        preferredTime: null,
        active: false
      },
      {
        assetId: null,
        segmentId: "s1",
        recurrenceType: "custom_days",
        recurrenceInterval: 12,
        recurrenceIntervalDays: 12,
        preferredTime: "10:00",
        active: true
      }
    ]);
  });

  it("monta o payload de reativação a partir do plano", () => {
    expect(buildReactivationPayload({ id: "p", name: "Plano", scopeType: "all", scopeId: "x", recurrenceType: "weekly" })).toEqual({
      name: "Plano",
      description: "",
      active: true,
      recurrenceType: "weekly",
      recurrenceInterval: 7,
      recurrenceIntervalDays: 7,
      preferredTime: "08:00",
      timezone: "America/Sao_Paulo",
      scopeType: "all",
      scopeId: null,
      defaultScriptIds: [],
      notes: "",
      overrides: []
    });
    expect(buildReactivationPayload({ name: "P", scopeType: "segment", scopeId: "s1" }).scopeId).toBe("s1");
  });
});

describe("exceções de recorrência", () => {
  const draft = { targetType: "segment", targetId: "s1", recurrenceType: "weekly", recurrenceInterval: 7, preferredTime: "" };

  it("cria a exceção com id derivado do instante informado", () => {
    expect(buildOverrideFromDraft(draft, [], 123)).toEqual({
      id: "draft-123",
      assetId: null,
      segmentId: "s1",
      recurrenceType: "weekly",
      recurrenceInterval: 7,
      recurrenceIntervalDays: 7,
      preferredTime: "08:00",
      active: true
    });
    expect(buildOverrideFromDraft({ ...draft, targetType: "asset", targetId: "d1" }, [], 1)).toMatchObject({
      assetId: "d1",
      segmentId: null
    });
  });

  it("recusa alvo vazio, duplicado e intervalo inválido", () => {
    expect(buildOverrideFromDraft({ ...draft, targetId: "" }, [])).toBeNull();
    expect(buildOverrideFromDraft(draft, [{ segmentId: "s1" }])).toBeNull();
    expect(buildOverrideFromDraft({ ...draft, targetType: "asset", targetId: "s1" }, [{ segmentId: "s1" }])).not.toBeNull();
    expect(buildOverrideFromDraft({ ...draft, recurrenceType: "custom_days", recurrenceInterval: 999 }, [])).toBeNull();
  });
});

describe("identidade do plano", () => {
  const plans = [
    { id: 1, name: "Limpeza", indicatorColor: "#2563eb" },
    { id: 2, name: "Outro", indicatorColor: "#dc2626" }
  ];

  it("detecta nome duplicado ignorando caixa, espaços e o próprio plano", () => {
    const result = findDuplicateAutomationIdentity(plans, { id: null, name: "  limpeza ", indicatorColor: "#000000" });
    expect(result.duplicateNamePlan).toBe(plans[0]);
    expect(result.hasDuplicateAutomationIdentity).toBe(true);

    expect(
      findDuplicateAutomationIdentity(plans, { id: 1, name: "Limpeza", indicatorColor: "#000000" }).hasDuplicateAutomationIdentity
    ).toBe(false);
  });

  it("detecta cor duplicada mesmo com nome livre", () => {
    const result = findDuplicateAutomationIdentity(plans, { id: null, name: "Novo", indicatorColor: "#DC2626" });
    expect(result.duplicateColorPlan).toBe(plans[1]);
    expect(result.hasDuplicateAutomationIdentity).toBe(true);
  });

  it("não bloqueia o envio quando o nome está vazio", () => {
    const result = findDuplicateAutomationIdentity([{ id: 1, name: "", indicatorColor: "#111111" }], {
      id: null,
      name: "",
      indicatorColor: "#222222"
    });
    expect(result.hasDuplicateAutomationIdentity).toBe(false);
  });

  it("indica se uma cor já é usada por outro plano", () => {
    expect(isColorUsedByOtherPlan(plans, null, "#2563eb")).toBe(true);
    expect(isColorUsedByOtherPlan(plans, 1, "#2563eb")).toBe(false);
    expect(isColorUsedByOtherPlan(plans, 1, "#ffffff")).toBe(false);
  });
});

describe("rótulos de escopo e recorrência", () => {
  it("lista as opções de escopo por tipo", () => {
    expect(getScopeOptions("asset", sources)).toEqual([
      { id: "d1", label: "PC-01 - 10.0.0.1" },
      { id: "d2", label: "d2 - Recepção" },
      { id: "d3", label: "d3 - sem IP" }
    ]);
    expect(getScopeOptions("segment", sources)).toEqual([{ id: "s1", label: "Recepção" }]);
    expect(getScopeOptions("group", sources)).toEqual([{ id: "g1", label: "Matriz" }]);
    expect(getScopeOptions("tab", sources)).toEqual([{ id: "t1", label: "Ambiente 1" }]);
    expect(getScopeOptions("outro", sources)).toEqual([]);
    expect(getScopeOptions("asset")).toEqual([]);
  });

  it("descreve o escopo do plano", () => {
    expect(getScopeLabel({ scopeType: "all" }, sources)).toBe("Todas as máquinas");
    expect(getScopeLabel({ scopeType: "asset_list", assetIds: ["a", "b"] }, sources)).toBe("Máquinas selecionadas: 2 máquina(s)");
    expect(getScopeLabel({ scopeType: "asset_list" }, sources)).toBe("Máquinas selecionadas: 0 máquina(s)");
    expect(getScopeLabel({ scopeType: "segment", scopeId: "s1" }, sources)).toBe("Segmento: Recepção");
    expect(getScopeLabel({ scopeType: "group", scopeId: "zz" }, sources)).toBe("Grupo: zz");
    expect(getScopeLabel({ scopeType: "tab" }, sources)).toBe("Escopo: não informado");
  });

  it("descreve a recorrência completa e resumida", () => {
    expect(getRecurrenceLabel({ recurrenceType: "weekly" })).toBe("Semanal - a cada 7 dia(s)");
    expect(getRecurrenceLabel({ recurrenceType: "custom_days", recurrenceInterval: 12 })).toBe("Personalizada em dias - a cada 12 dia(s)");
    expect(getRecurrenceLabel({})).toBe("Mensal - a cada 30 dia(s)");
    expect(getRecurrenceShortLabel({ recurrenceType: "custom_days", recurrenceInterval: 12 })).toBe("A cada 12 dia(s)");
    expect(getRecurrenceShortLabel({ recurrenceType: "biweekly" })).toBe("Quinzenal");
  });

  it("descreve o alvo de uma exceção", () => {
    expect(getOverrideLabel({ segmentId: "s1", recurrenceType: "weekly" }, sources)).toBe("Segmento: Recepção • Semanal");
    expect(getOverrideLabel({ assetId: "d1", recurrenceType: "custom_days", recurrenceInterval: 3 }, sources)).toBe(
      "Máquina: PC-01 - 10.0.0.1 • A cada 3 dia(s)"
    );
    expect(getOverrideLabel({ assetId: "zz", recurrenceType: "daily" }, sources)).toBe("Máquina: zz • Diária");
  });
});
