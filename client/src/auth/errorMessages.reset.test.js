import { describe, expect, it } from "vitest";
import { describeIdentityError, identityMessages } from "./errorMessages.js";

describe("mensagens da recuperacao de senha", () => {
  it("traduz os codigos estaveis do servidor", () => {
    expect(describeIdentityError({ code: "RESET_TOKEN_INVALID" })).toBe(identityMessages.RESET_TOKEN_INVALID);
    expect(identityMessages.RESET_TOKEN_INVALID).toMatch(/inválido ou expirou/);
    expect(describeIdentityError({ code: "INVALID_EMAIL" })).toBe("Informe um e-mail válido.");
    expect(describeIdentityError({ code: "MAIL_NOT_CONFIGURED" })).toMatch(/e-mail não está configurado/);
    expect(describeIdentityError({ code: "MAIL_SEND_FAILED" })).toMatch(/Não foi possível enviar o e-mail/);
  });
});
