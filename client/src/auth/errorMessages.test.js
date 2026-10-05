import { describe, expect, it } from "vitest";
import { describeIdentityError, identityMessages, weakPasswordDetails } from "./errorMessages.js";

describe("describeIdentityError", () => {
  it("traduz cada codigo estavel do backend", () => {
    for (const code of Object.keys(identityMessages)) {
      expect(describeIdentityError({ code, message: "x" })).toBe(identityMessages[code]);
    }
  });

  it("bloqueio de conta mostra o aviso de excesso de tentativas", () => {
    expect(describeIdentityError({ code: "ACCOUNT_LOCKED", statusCode: 429 })).toBe(
      "Muitas tentativas. Aguarde alguns minutos e tente novamente."
    );
  });

  it("429 do rate limiter (sem codigo) tambem vira o aviso de tentativas", () => {
    expect(describeIdentityError({ statusCode: 429, message: "Too many requests" })).toBe(identityMessages.ACCOUNT_LOCKED);
  });

  it("senha fraca mostra a primeira regra devolvida pelo servidor", () => {
    expect(describeIdentityError({ code: "WEAK_PASSWORD", details: ["Muito comum.", "Outra."], message: "m" })).toBe(
      "Muito comum."
    );
  });

  it("sem codigo conhecido usa a mensagem do servidor, o fallback em 5xx e o padrao sem nada", () => {
    expect(describeIdentityError({ statusCode: 400, message: "Informe o nome." })).toBe("Informe o nome.");
    expect(describeIdentityError({ statusCode: 500, message: "boom" }, "Falhou.")).toBe("Falhou.");
    expect(describeIdentityError({})).toBe("Não foi possível concluir a operação. Tente novamente.");
    expect(describeIdentityError(null)).toBe("Não foi possível concluir a operação. Tente novamente.");
  });
});

describe("weakPasswordDetails", () => {
  it("devolve a lista so para WEAK_PASSWORD", () => {
    expect(weakPasswordDetails({ code: "WEAK_PASSWORD", details: ["a"] })).toEqual(["a"]);
    expect(weakPasswordDetails({ code: "WEAK_PASSWORD" })).toEqual([]);
    expect(weakPasswordDetails({ code: "OUTRO", details: ["a"] })).toEqual([]);
  });
});
