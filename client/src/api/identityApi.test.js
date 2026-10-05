import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_RESTRICTED_EVENT, AUTH_EXPIRED_EVENT } from "../authSession.js";
import * as identity from "./identityApi.js";

function respond(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new Error("sem corpo")) : Promise.resolve(body))
  });
}

function lastCall() {
  const [url, init] = fetch.mock.calls.at(-1);
  return { url, init, body: init.body ? JSON.parse(init.body) : undefined };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("identityApi: requisicoes", () => {
  it("login envia e-mail e senha com cookie e sem Authorization", async () => {
    fetch.mockReturnValue(respond(200, { user: { id: "u1" }, token: "t" }));
    const data = await identity.login({ email: "a@b.com", password: "x" });

    const { url, init, body } = lastCall();
    expect(data.token).toBe("t");
    expect(url).toMatch(/\/api\/auth\/login$/);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers.Authorization).toBeUndefined();
    expect(body).toEqual({ email: "a@b.com", password: "x" });
  });

  it("loginMfa envia codigo TOTP ou codigo de recuperacao, nunca os dois", async () => {
    fetch.mockReturnValue(respond(200, {}));
    await identity.loginMfa({ mfaToken: "m", code: "123456" });
    expect(lastCall().body).toEqual({ mfaToken: "m", code: "123456" });
    await identity.loginMfa({ mfaToken: "m", recoveryCode: "ABCDE-FGHJK", code: "123456" });
    expect(lastCall().body).toEqual({ mfaToken: "m", recoveryCode: "ABCDE-FGHJK" });
  });

  it("register so inclui o token de configuracao quando informado", async () => {
    fetch.mockReturnValue(respond(201, {}));
    await identity.register({ name: "Ana", email: "a@b.com", password: "p", setupToken: "" });
    expect(lastCall().body).toEqual({ name: "Ana", email: "a@b.com", password: "p" });
    await identity.register({ name: "Ana", email: "a@b.com", password: "p", setupToken: "tok" });
    expect(lastCall().body.setupToken).toBe("tok");
  });

  it("chamadas autenticadas levam o Bearer e os metodos/rotas corretos", async () => {
    fetch.mockReturnValue(respond(200, { sessions: [{ id: "s1" }], revoked: 2 }));

    await identity.fetchMe("tok");
    expect(lastCall().url).toMatch(/\/auth\/me$/);
    expect(lastCall().init.headers.Authorization).toBe("Bearer tok");

    await identity.changePassword("tok", { currentPassword: "a", newPassword: "b" });
    expect(lastCall().body).toEqual({ currentPassword: "a", newPassword: "b" });

    expect(await identity.fetchSessions("tok")).toEqual([{ id: "s1" }]);

    await identity.revokeSession("tok", "a/b");
    expect(lastCall().url).toMatch(/\/auth\/sessions\/a%2Fb$/);
    expect(lastCall().init.method).toBe("DELETE");

    expect(await identity.revokeOtherSessions("tok")).toEqual(expect.objectContaining({ revoked: 2 }));
    expect(lastCall().url).toMatch(/\/auth\/sessions\/revoke-others$/);

    await identity.fetchMfaStatus("tok");
    await identity.startMfaSetup("tok");
    expect(lastCall().url).toMatch(/\/auth\/mfa\/setup$/);
    await identity.enableMfa("tok", "123456");
    expect(lastCall().body).toEqual({ code: "123456" });
    await identity.disableMfa("tok", { password: "p", code: "123456" });
    expect(lastCall().url).toMatch(/\/auth\/mfa\/disable$/);
    await identity.regenerateRecoveryCodes("tok", { password: "p", recoveryCode: "X" });
    expect(lastCall().url).toMatch(/\/auth\/mfa\/recovery-codes$/);
  });

  it("rotas de administrador codificam o id do usuario", async () => {
    fetch.mockReturnValue(respond(200, { temporaryPassword: "tmp" }));
    await identity.adminResetPassword("tok", "u 1");
    expect(lastCall().url).toMatch(/\/users\/u%201\/reset-password$/);
    await identity.adminResetMfa("tok", "u1");
    expect(lastCall().url).toMatch(/\/users\/u1\/mfa\/reset$/);
  });

  it("tolera resposta 204 sem corpo", async () => {
    fetch.mockReturnValue(respond(204, undefined));
    await expect(identity.disableMfa("tok", {})).resolves.toEqual({});
  });
});

describe("identityApi: erros", () => {
  it("preserva status, code, details e requestId do servidor", async () => {
    fetch.mockReturnValue(
      respond(400, { message: "Senha fraca", code: "WEAK_PASSWORD", details: ["a", "b"], requestId: "r1" })
    );
    const error = await identity.changePassword("tok", {}).catch((failure) => failure);

    expect(error).toBeInstanceOf(identity.IdentityApiError);
    expect(error).toMatchObject({ message: "Senha fraca", statusCode: 400, code: "WEAK_PASSWORD", requestId: "r1" });
    expect(error.details).toEqual(["a", "b"]);
  });

  it("usa mensagem padrao quando o corpo nao e JSON", async () => {
    fetch.mockReturnValue(respond(502, undefined));
    const error = await identity.login({}).catch((failure) => failure);
    expect(error.message).toBe("Request failed");
    expect(error.details).toEqual([]);
  });

  it("falha de rede vira erro com codigo NETWORK_ERROR", async () => {
    fetch.mockRejectedValue(new TypeError("fetch failed"));
    const error = await identity.login({}).catch((failure) => failure);
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toBe("Não foi possível conectar ao servidor.");
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it("401 de sessao perdida com token avisa o app (sem entrar em loop em 401 de credencial)", async () => {
    const expired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, expired);

    fetch.mockReturnValue(respond(401, { message: "Sessão inválida ou expirada.", code: "SESSION_INVALID" }));
    await identity.fetchSessions("tok").catch(() => {});
    expect(expired).toHaveBeenCalledTimes(1);

    // Sem token (login) ou com 401 de credencial: nunca derruba a sessao.
    await identity.login({}).catch(() => {});
    fetch.mockReturnValue(respond(401, { message: "Senha atual", code: "CURRENT_PASSWORD_INVALID" }));
    await identity.changePassword("tok", {}).catch(() => {});
    fetch.mockReturnValue(respond(401, { message: "Código", code: "MFA_CODE_INVALID" }));
    await identity.disableMfa("tok", {}).catch(() => {});
    expect(expired).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_EXPIRED_EVENT, expired);
  });

  it("403 de conta restrita publica o codigo para o porteiro da conta", async () => {
    const restricted = vi.fn();
    window.addEventListener(ACCOUNT_RESTRICTED_EVENT, restricted);

    fetch.mockReturnValue(respond(403, { message: "Troque a senha", code: "PASSWORD_CHANGE_REQUIRED" }));
    await identity.fetchSessions("tok").catch(() => {});
    fetch.mockReturnValue(respond(403, { message: "Sem permissao" }));
    await identity.fetchSessions("tok").catch(() => {});

    expect(restricted).toHaveBeenCalledTimes(1);
    expect(restricted.mock.calls[0][0].detail).toEqual({ code: "PASSWORD_CHANGE_REQUIRED" });
    window.removeEventListener(ACCOUNT_RESTRICTED_EVENT, restricted);
  });
});
