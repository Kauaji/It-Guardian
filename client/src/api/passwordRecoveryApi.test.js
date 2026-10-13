import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as recovery from "./passwordRecoveryApi.js";

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

describe("passwordRecoveryApi", () => {
  it("fetchAuthOptions consulta as opcoes publicas sem Authorization", async () => {
    fetch.mockReturnValue(respond(200, { passwordReset: { enabled: true } }));
    const options = await recovery.fetchAuthOptions();
    const { url, init } = lastCall();
    expect(options.passwordReset.enabled).toBe(true);
    expect(url).toMatch(/\/api\/auth\/options$/);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("requestPasswordReset envia so o e-mail", async () => {
    fetch.mockReturnValue(respond(202, { message: "ok" }));
    await recovery.requestPasswordReset("ana@empresa.com");
    const { url, init, body } = lastCall();
    expect(url).toMatch(/\/api\/auth\/password\/forgot$/);
    expect(init.method).toBe("POST");
    expect(body).toEqual({ email: "ana@empresa.com" });
  });

  it("resetPassword envia token e nova senha no corpo (nunca na URL)", async () => {
    fetch.mockReturnValue(respond(200, { ok: true }));
    await recovery.resetPassword("TOKEN", "nova-senha-longa-123");
    const { url, init, body } = lastCall();
    expect(url).toMatch(/\/api\/auth\/password\/reset$/);
    expect(url).not.toContain("TOKEN");
    expect(init.method).toBe("POST");
    expect(body).toEqual({ token: "TOKEN", newPassword: "nova-senha-longa-123" });
  });

  it("adminSendResetLink usa a sessao do administrador", async () => {
    fetch.mockReturnValue(respond(200, { sent: true }));
    await recovery.adminSendResetLink("tok-admin", "u 2");
    const { url, init } = lastCall();
    expect(url).toMatch(/\/api\/users\/u%202\/send-reset-link$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok-admin");
  });
});
