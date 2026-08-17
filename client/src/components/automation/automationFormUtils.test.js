import { describe, expect, it } from "vitest";
import {
  automationDraftsEqual,
  buildAutomationOverrideDraft,
  buildAutomationPlanDraft,
  validateAutomationOverrideDraft,
  validateAutomationPlanDraft
} from "./automationFormUtils.js";

function validPlanDraft(overrides = {}) {
  return {
    name: "Plano de Manutenção",
    description: "",
    notes: "",
    active: true,
    recurrenceType: "monthly",
    recurrenceIntervalDays: 30,
    preferredTime: "08:00",
    timezone: "America/Sao_Paulo",
    indicatorColor: "#1f7a61",
    defaultScriptIds: ["script-1"],
    ...overrides
  };
}

function validOverrideDraft(overrides = {}) {
  return {
    recurrenceType: "monthly",
    recurrenceIntervalDays: 30,
    preferredTime: "08:00",
    active: true,
    ...overrides
  };
}

describe("buildAutomationPlanDraft", () => {
  it("aplica os valores padrao quando nao ha plano existente", () => {
    const draft = buildAutomationPlanDraft();
    expect(draft).toEqual({
      name: "",
      description: "",
      notes: "",
      active: true,
      recurrenceType: "monthly",
      recurrenceIntervalDays: 30,
      preferredTime: "08:00",
      timezone: "America/Sao_Paulo",
      indicatorColor: "#1f7a61",
      defaultScriptIds: []
    });
  });

  it("deriva o rascunho a partir de um plano existente", () => {
    const plan = {
      name: "Manutencao preventiva",
      active: false,
      recurrenceType: "weekly",
      recurrenceIntervalDays: 14,
      preferredTime: "09:30",
      timezone: "America/Manaus",
      indicatorColor: "#ff0000",
      defaultScriptIds: ["s1", "s2"]
    };
    const draft = buildAutomationPlanDraft(plan);
    expect(draft).toEqual({
      name: "Manutencao preventiva",
      description: "",
      notes: "",
      active: false,
      recurrenceType: "weekly",
      recurrenceIntervalDays: 14,
      preferredTime: "09:30",
      timezone: "America/Manaus",
      indicatorColor: "#ff0000",
      defaultScriptIds: ["s1", "s2"]
    });
  });

  it("usa recurrenceInterval (campo legado) quando recurrenceIntervalDays nao existe", () => {
    const draft = buildAutomationPlanDraft({ recurrenceInterval: 45 });
    expect(draft.recurrenceIntervalDays).toBe(45);
  });

  it("copia defaultScriptIds em um novo array, sem manter a mesma referencia", () => {
    const ids = ["a", "b"];
    const draft = buildAutomationPlanDraft({ defaultScriptIds: ids });
    expect(draft.defaultScriptIds).toEqual(ids);
    expect(draft.defaultScriptIds).not.toBe(ids);
  });

  it("trata defaultScriptIds invalido (nao-array) como lista vazia", () => {
    const draft = buildAutomationPlanDraft({ defaultScriptIds: "script-1" });
    expect(draft.defaultScriptIds).toEqual([]);
  });
});

describe("buildAutomationOverrideDraft", () => {
  it("aplica os valores padrao quando nao ha override, schedule nem plano", () => {
    const draft = buildAutomationOverrideDraft();
    expect(draft).toEqual({
      recurrenceType: "monthly",
      recurrenceIntervalDays: 30,
      preferredTime: "08:00",
      active: true
    });
  });

  it("deriva o rascunho de um override ativo, priorizando os valores do override", () => {
    const override = {
      active: true,
      recurrenceType: "weekly",
      recurrenceIntervalDays: 7,
      preferredTime: "09:30"
    };
    const schedule = { recurrenceType: "daily", preferredTime: "06:00" };
    const plan = { preferredTime: "10:00" };
    const draft = buildAutomationOverrideDraft({ override, schedule, plan });
    expect(draft).toEqual({
      recurrenceType: "weekly",
      recurrenceIntervalDays: 7,
      preferredTime: "09:30",
      active: true
    });
  });

  it("ignora um override marcado como inativo e cai para o schedule, mas ainda reporta active=true", () => {
    const override = { active: false, recurrenceType: "daily" };
    const schedule = { recurrenceType: "biweekly", recurrenceIntervalDays: 14, preferredTime: "07:00" };
    const plan = { preferredTime: "10:00" };
    const draft = buildAutomationOverrideDraft({ override, schedule, plan });
    expect(draft).toEqual({
      recurrenceType: "biweekly",
      recurrenceIntervalDays: 14,
      preferredTime: "07:00",
      active: true
    });
  });

  it("usa o preferredTime do plano como ultimo fallback quando o schedule nao o define", () => {
    const schedule = { recurrenceType: "monthly" };
    const plan = { preferredTime: "10:15" };
    const draft = buildAutomationOverrideDraft({ schedule, plan });
    expect(draft.preferredTime).toBe("10:15");
    expect(draft.active).toBe(true);
  });
});

describe("validateAutomationPlanDraft", () => {
  it("retorna objeto de erros vazio para um rascunho valido", () => {
    expect(validateAutomationPlanDraft(validPlanDraft())).toEqual({});
  });

  it("acusa erro quando o nome tem menos de 3 caracteres", () => {
    const errors = validateAutomationPlanDraft(validPlanDraft({ name: "Ab" }));
    expect(errors.name).toBeDefined();
  });

  it("acusa erro quando nenhum script padrao foi selecionado", () => {
    const errors = validateAutomationPlanDraft(validPlanDraft({ defaultScriptIds: [] }));
    expect(errors.defaultScriptIds).toBeDefined();
  });

  it("acusa erro quando a recorrencia nao esta na lista permitida", () => {
    const errors = validateAutomationPlanDraft(validPlanDraft({ recurrenceType: "yearly" }));
    expect(errors.recurrenceType).toBeDefined();
  });

  it("acusa erro quando custom_days tem um intervalo fora do intervalo 1-365", () => {
    const tooLow = validateAutomationPlanDraft(
      validPlanDraft({ recurrenceType: "custom_days", recurrenceIntervalDays: 0 })
    );
    const tooHigh = validateAutomationPlanDraft(
      validPlanDraft({ recurrenceType: "custom_days", recurrenceIntervalDays: 400 })
    );
    expect(tooLow.recurrenceIntervalDays).toBeDefined();
    expect(tooHigh.recurrenceIntervalDays).toBeDefined();
  });

  it("aceita custom_days com um intervalo valido", () => {
    const errors = validateAutomationPlanDraft(
      validPlanDraft({ recurrenceType: "custom_days", recurrenceIntervalDays: 10 })
    );
    expect(errors.recurrenceIntervalDays).toBeUndefined();
  });

  it("acusa erro quando o horario preferido e invalido", () => {
    const errors = validateAutomationPlanDraft(validPlanDraft({ preferredTime: "25:00" }));
    expect(errors.preferredTime).toBeDefined();
  });

  it("acusa erro quando a cor indicadora nao e um hexadecimal valido", () => {
    const errors = validateAutomationPlanDraft(validPlanDraft({ indicatorColor: "verde" }));
    expect(errors.indicatorColor).toBeDefined();
  });

  it("acusa erro quando o fuso horario nao esta na lista permitida", () => {
    const errors = validateAutomationPlanDraft(validPlanDraft({ timezone: "America/New_York" }));
    expect(errors.timezone).toBeDefined();
  });
});

describe("validateAutomationOverrideDraft", () => {
  it("retorna objeto de erros vazio para um rascunho valido, mesmo sem nome/cor/fuso", () => {
    expect(validateAutomationOverrideDraft(validOverrideDraft())).toEqual({});
  });

  it("acusa erro quando a recorrencia nao esta na lista permitida", () => {
    const errors = validateAutomationOverrideDraft(validOverrideDraft({ recurrenceType: "yearly" }));
    expect(errors.recurrenceType).toBeDefined();
  });

  it("acusa erro quando custom_days tem um intervalo fora do intervalo 1-365", () => {
    const errors = validateAutomationOverrideDraft(
      validOverrideDraft({ recurrenceType: "custom_days", recurrenceIntervalDays: 400 })
    );
    expect(errors.recurrenceIntervalDays).toBeDefined();
  });

  it("acusa erro quando o horario preferido e invalido", () => {
    const errors = validateAutomationOverrideDraft(validOverrideDraft({ preferredTime: "9:00" }));
    expect(errors.preferredTime).toBeDefined();
  });

  it("nao valida nome, cor ou fuso horario, diferente da validacao de plano", () => {
    const draft = { recurrenceType: "monthly", recurrenceIntervalDays: 30, preferredTime: "08:00" };
    expect(validateAutomationOverrideDraft(draft)).toEqual({});
  });
});

describe("automationDraftsEqual", () => {
  it("retorna true para rascunhos equivalentes construidos por caminhos diferentes", () => {
    const left = buildAutomationPlanDraft({ name: "X", defaultScriptIds: ["b", "a"] });
    const right = buildAutomationPlanDraft({ name: "X", defaultScriptIds: ["a", "b"] });
    expect(automationDraftsEqual(left, right)).toBe(true);
    expect(automationDraftsEqual(right, left)).toBe(true);
  });

  it("ignora a ordem dos itens em campos de array ao comparar", () => {
    const left = { ids: [1, 2, 3] };
    const right = { ids: [3, 2, 1] };
    expect(automationDraftsEqual(left, right)).toBe(true);
  });

  it("retorna false quando um campo relevante difere", () => {
    const left = buildAutomationPlanDraft({ name: "X" });
    const right = buildAutomationPlanDraft({ name: "Y" });
    expect(automationDraftsEqual(left, right)).toBe(false);
    expect(automationDraftsEqual(right, left)).toBe(false);
  });

  it("retorna false quando um campo booleano difere", () => {
    expect(automationDraftsEqual({ active: true }, { active: false })).toBe(false);
  });

  it("retorna false quando uma chave existe em apenas um dos rascunhos", () => {
    const left = { name: "A" };
    const right = { name: "A", extra: "valor" };
    expect(automationDraftsEqual(left, right)).toBe(false);
    expect(automationDraftsEqual(right, left)).toBe(false);
  });
});
