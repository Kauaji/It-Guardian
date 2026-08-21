import { describe, expect, it } from "vitest";
import { honeypotFieldName, urgencyOptions, validatePublicSupportForm } from "./publicSupportValidation.js";

function validForm(overrides = {}) {
  return {
    title: "Computador não liga",
    description: "Parou de funcionar hoje de manhã.",
    category: "Computador",
    problemType: "Computador não liga",
    requesterName: "Maria Silva",
    contactInfo: "",
    environmentName: "Não identificado",
    ...overrides
  };
}

describe("validatePublicSupportForm", () => {
  it("aceita um formulário válido no modo local", () => {
    expect(validatePublicSupportForm(validForm(), { businessMode: false })).toBe("");
  });

  it("recusa título muito curto", () => {
    const error = validatePublicSupportForm(validForm({ title: "Oi" }), { businessMode: false });
    expect(error).toMatch(/título/);
  });

  it("recusa descrição muito curta", () => {
    const error = validatePublicSupportForm(validForm({ description: "Oi" }), { businessMode: false });
    expect(error).toMatch(/detalhe/);
  });

  it("recusa quando falta categoria", () => {
    const error = validatePublicSupportForm(validForm({ category: "" }), { businessMode: false });
    expect(error).toMatch(/categoria/);
  });

  it("recusa quando falta tipo de problema", () => {
    const error = validatePublicSupportForm(validForm({ problemType: "" }), { businessMode: false });
    expect(error).toMatch(/tipo de problema/);
  });

  it("recusa quando falta nome do solicitante", () => {
    const error = validatePublicSupportForm(validForm({ requesterName: "  " }), { businessMode: false });
    expect(error).toMatch(/solicitante/);
  });

  it("no modo business, exige contato", () => {
    const error = validatePublicSupportForm(
      validForm({ contactInfo: "", environmentName: "Filial Centro" }),
      { businessMode: true }
    );
    expect(error).toMatch(/contato/);
  });

  it("no modo business, exige cliente/ambiente identificado", () => {
    const error = validatePublicSupportForm(
      validForm({ contactInfo: "11999999999", environmentName: "Não identificado" }),
      { businessMode: true }
    );
    expect(error).toMatch(/cliente/);
  });

  it("no modo business, aceita quando contato e ambiente estão preenchidos", () => {
    const error = validatePublicSupportForm(
      validForm({ contactInfo: "11999999999", environmentName: "Filial Centro" }),
      { businessMode: true }
    );
    expect(error).toBe("");
  });

  it("ignora acentuação e caixa ao checar 'não identificado'", () => {
    const error = validatePublicSupportForm(
      validForm({ contactInfo: "11999999999", environmentName: "NAO IDENTIFICADO" }),
      { businessMode: true }
    );
    expect(error).toMatch(/cliente/);
  });
});

describe("honeypotFieldName", () => {
  it("expõe um nome de campo estável, usado também pelo backend", () => {
    expect(honeypotFieldName).toBe("website");
  });
});

describe("urgencyOptions", () => {
  it("expõe as opções de urgência percebida com rótulos em português", () => {
    expect(urgencyOptions.map((option) => option.value)).toEqual(["low", "normal", "high", "urgent"]);
    urgencyOptions.forEach((option) => {
      expect(typeof option.label).toBe("string");
      expect(option.label.length).toBeGreaterThan(0);
    });
  });
});
