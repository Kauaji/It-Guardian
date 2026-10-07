import { describe, expect, it } from "vitest";
import { getServiceOrderModeError, isMaintenanceServiceOrder } from "./serviceOrderRules.js";

const complete = {
  title: "Trocar fonte",
  description: "Nao liga",
  category: "Hardware",
  requesterName: "Ana",
  environmentId: "env-1",
  assetId: "asset-1"
};

describe("getServiceOrderModeError", () => {
  it("exige titulo com pelo menos 3 caracteres em qualquer modo", () => {
    expect(getServiceOrderModeError({ ...complete, title: " ab " }, "local")).toMatch(/título/);
    expect(getServiceOrderModeError(undefined, "business")).toMatch(/título/);
  });

  it("modo local exige descricao, categoria e solicitante, nessa ordem", () => {
    expect(getServiceOrderModeError({ ...complete, description: "" }, "local")).toMatch(/observações/);
    expect(getServiceOrderModeError({ ...complete, category: "" }, "local")).toMatch(/categoria/);
    expect(getServiceOrderModeError({ ...complete, requesterName: "" }, "local")).toMatch(/solicitante/);
    expect(getServiceOrderModeError({ ...complete, environmentId: "", assetId: "" }, "local")).toBe("");
  });

  it("modo business exige cliente e ativo antes dos demais campos", () => {
    expect(getServiceOrderModeError({ ...complete, environmentId: "" }, "business")).toMatch(/cliente/);
    expect(getServiceOrderModeError({ ...complete, assetId: "" }, "business")).toMatch(/máquina/);
    expect(getServiceOrderModeError({ ...complete, requesterName: "" }, "business")).toMatch(/solicitante/);
    expect(getServiceOrderModeError({ ...complete, category: "" }, "business")).toMatch(/categoria/);
    expect(getServiceOrderModeError({ ...complete, description: "" }, "business")).toMatch(/descreva/);
    expect(getServiceOrderModeError(complete, "business")).toBe("");
  });
});

describe("isMaintenanceServiceOrder", () => {
  it("reconhece OS de manutencao vinculada a um ativo, sem diferenciar acento/caixa", () => {
    expect(isMaintenanceServiceOrder({ assetId: "a", category: " Manutencao " })).toBe(true);
    expect(isMaintenanceServiceOrder({ assetId: "a", category: "Hardware" })).toBe(false);
    expect(isMaintenanceServiceOrder({ category: "manutencao" })).toBe(false);
    expect(isMaintenanceServiceOrder(null)).toBe(false);
  });

  it("preserva o comportamento original: a comparacao e com 'manutencao' sem acento", () => {
    // Pendencia conhecida: a OS criada ao colocar uma maquina em manutencao usa
    // a categoria acentuada ("Manutenção"), que esta regra nao reconhece.
    expect(isMaintenanceServiceOrder({ assetId: "a", category: "Manutenção" })).toBe(false);
  });
});
