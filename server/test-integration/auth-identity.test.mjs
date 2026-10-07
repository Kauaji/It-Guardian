import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "auth-identity-integration-secret-with-32-chars";
process.env.NODE_ENV = "test";
process.env.AUTH_RATE_LIMIT_MAX = "1000";
process.env.LOGIN_LOCKOUT_THRESHOLD = "3";
process.env.PASSWORD_HASH_COST = "10";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { totpAt } = await import("../src/domain/totp.js");
const { seedDefaultAdmin } = await import("../src/repositories/userRepository.js");
const { startSession } = await import("../src/services/sessionService.js");
const { findUserByEmail } = await import("../src/repositories/userRepository.js");
const jwt = (await import("jsonwebtoken")).default;

const origin = "http://localhost:5173";
const adminEmail = "admin@itguardian.local";
const adminPassword = "123456";

let server;
let baseUrl;

test.before(async () => {
  await initializeRuntime();
  server = await new Promise((resolve) => {
    const instance = createApp().listen(0, "127.0.0.1", () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
});

function cookieOf(response) {
  return (response.headers.get("set-cookie") || "").split(";")[0];
}

async function call(path, { method = "GET", cookie, token, body, headers = {} } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin,
      ...(cookie ? { cookie } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function login(email, password) {
  const response = await call("/api/auth/login", { method: "POST", body: { email, password } });
  return { response, cookie: cookieOf(response), body: await response.json().catch(() => ({})) };
}

async function createManagedUser(adminCookie, overrides = {}) {
  const email = `pessoa.${Math.random().toString(36).slice(2, 8)}@empresa.test`;
  const response = await call("/api/users", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "Pessoa Teste",
      email,
      password: "cavalo-bateria-grampo-correto",
      role: "operator",
      ...overrides
    }
  });
  return { email, response, body: await response.json() };
}

test("login abre uma sessao revogavel e o logout a encerra de verdade", async () => {
  const { response, cookie, body } = await login(adminEmail, adminPassword);
  assert.equal(response.status, 200);
  assert.ok(cookie.startsWith("it_guardian_session="));
  assert.ok(body.session.absoluteExpiresAt);

  const me = await call("/api/auth/me", { cookie });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.email, adminEmail);

  const logout = await call("/api/auth/logout", { method: "POST", cookie });
  assert.equal(logout.status, 204);

  // O cookie antigo continua "bem assinado", mas a sessao foi revogada.
  const afterLogout = await call("/api/auth/me", { cookie });
  assert.equal(afterLogout.status, 401);
  assert.equal((await afterLogout.json()).code, "SESSION_INVALID");
});

test("tokens forjados, sem sessao ou com algoritmo none sao rejeitados", async () => {
  const adminUser = await findUserByEmail(adminEmail);
  const noSession = jwt.sign({ sub: adminUser.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  assert.equal((await call("/api/auth/me", { token: noSession })).status, 401);

  const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(
    JSON.stringify({ sub: adminUser.id, sid: "x", ver: 0, typ: "session" })
  ).toString("base64url")}.`;
  assert.equal((await call("/api/auth/me", { token: unsigned })).status, 401);

  const wrongSecret = jwt.sign({ sub: adminUser.id, sid: "x", ver: 0, typ: "session" }, "outra-chave-qualquer-com-32-caracteres!!");
  assert.equal((await call("/api/auth/me", { token: wrongSecret })).status, 401);
});

test("mensagem de login e igual para e-mail inexistente e senha errada", async () => {
  const unknown = await login("ninguem@empresa.test", "qualquer-coisa-aqui-123");
  const wrong = await login(adminEmail, "senha-errada-qualquer-123");
  assert.equal(unknown.response.status, 401);
  assert.equal(wrong.response.status, 401);
  assert.equal(unknown.body.message, wrong.body.message);
});

test("bloqueia a conta apos falhas seguidas e libera depois do prazo", async () => {
  const admin = (await login(adminEmail, adminPassword)).cookie;
  const { email } = await createManagedUser(admin, { mustChangePassword: false });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.equal((await login(email, "senha-errada-qualquer-123")).response.status, 401);
  }
  const locked = await login(email, "cavalo-bateria-grampo-correto");
  assert.equal(locked.response.status, 429);
  assert.equal(locked.body.code, "ACCOUNT_LOCKED");

  await query("UPDATE users SET locked_until = NOW() - INTERVAL '1 second' WHERE email = $1", [email]);
  assert.equal((await login(email, "cavalo-bateria-grampo-correto")).response.status, 200);
});

test("troca de senha exige a atual, aplica a politica e derruba as outras sessoes", async () => {
  const admin = (await login(adminEmail, adminPassword)).cookie;
  const { email } = await createManagedUser(admin, { mustChangePassword: false });

  const first = await login(email, "cavalo-bateria-grampo-correto");
  const second = await login(email, "cavalo-bateria-grampo-correto");
  assert.equal(first.response.status, 200);

  const wrongCurrent = await call("/api/auth/password", {
    method: "POST",
    cookie: first.cookie,
    body: { currentPassword: "nao-e-essa-senha-123", newPassword: "outra-frase-bem-longa-9" }
  });
  assert.equal(wrongCurrent.status, 401);

  const weak = await call("/api/auth/password", {
    method: "POST",
    cookie: first.cookie,
    body: { currentPassword: "cavalo-bateria-grampo-correto", newPassword: "senha123" }
  });
  assert.equal(weak.status, 400);
  assert.equal((await weak.json()).code, "WEAK_PASSWORD");

  const changed = await call("/api/auth/password", {
    method: "POST",
    cookie: first.cookie,
    body: { currentPassword: "cavalo-bateria-grampo-correto", newPassword: "outra-frase-bem-longa-9" }
  });
  assert.equal(changed.status, 200);
  const newCookie = cookieOf(changed);

  assert.equal((await call("/api/auth/me", { cookie: first.cookie })).status, 401);
  assert.equal((await call("/api/auth/me", { cookie: second.cookie })).status, 401);
  assert.equal((await call("/api/auth/me", { cookie: newCookie })).status, 200);
  assert.equal((await login(email, "cavalo-bateria-grampo-correto")).response.status, 401);
  assert.equal((await login(email, "outra-frase-bem-longa-9")).response.status, 200);
});

test("conta criada pelo admin precisa trocar a senha antes de usar o sistema", async () => {
  const admin = (await login(adminEmail, adminPassword)).cookie;
  const weak = await createManagedUser(admin, { password: "123456" });
  assert.equal(weak.response.status, 400);
  assert.equal(weak.body.code, "WEAK_PASSWORD");

  const { email, response } = await createManagedUser(admin);
  assert.equal(response.status, 201);

  const session = await login(email, "cavalo-bateria-grampo-correto");
  assert.equal(session.response.status, 200);
  assert.equal(session.body.user.mustChangePassword, true);

  const blocked = await call("/api/service-orders", { cookie: session.cookie });
  assert.equal(blocked.status, 403);
  assert.equal((await blocked.json()).code, "PASSWORD_CHANGE_REQUIRED");

  const changed = await call("/api/auth/password", {
    method: "POST",
    cookie: session.cookie,
    body: { currentPassword: "cavalo-bateria-grampo-correto", newPassword: "uma-frase-nova-bem-longa-7" }
  });
  assert.equal(changed.status, 200);
  assert.notEqual((await call("/api/service-orders", { cookie: cookieOf(changed) })).status, 403);
});

test("admin redefine a senha: temporaria exibida uma vez, sessoes derrubadas, troca obrigatoria", async () => {
  const admin = (await login(adminEmail, adminPassword)).cookie;
  const { email, body } = await createManagedUser(admin, { mustChangePassword: false });
  const victim = await login(email, "cavalo-bateria-grampo-correto");

  const reset = await call(`/api/users/${body.user.id}/reset-password`, { method: "POST", cookie: admin });
  assert.equal(reset.status, 200);
  const { temporaryPassword } = await reset.json();
  assert.equal(temporaryPassword.length, 16);

  assert.equal((await call("/api/auth/me", { cookie: victim.cookie })).status, 401);
  assert.equal((await login(email, "cavalo-bateria-grampo-correto")).response.status, 401);
  const withTemp = await login(email, temporaryPassword);
  assert.equal(withTemp.response.status, 200);
  assert.equal(withTemp.body.user.mustChangePassword, true);

  const forbidden = await call(`/api/users/${body.user.id}/reset-password`, { method: "POST", cookie: withTemp.cookie });
  assert.equal(forbidden.status, 403);
});

test("MFA: ativa, exige o segundo fator no login, bloqueia replay e aceita codigo de recuperacao uma vez", async () => {
  const admin = (await login(adminEmail, adminPassword)).cookie;
  const { email } = await createManagedUser(admin, { mustChangePassword: false });
  const session = await login(email, "cavalo-bateria-grampo-correto");

  const setup = await call("/api/auth/mfa/setup", { method: "POST", cookie: session.cookie });
  assert.equal(setup.status, 200);
  const { secret, otpauthUri } = await setup.json();
  assert.match(otpauthUri, /^otpauth:\/\/totp\//);

  const badCode = await call("/api/auth/mfa/enable", { method: "POST", cookie: session.cookie, body: { code: "000000" } });
  assert.equal(badCode.status, 400);

  const enabled = await call("/api/auth/mfa/enable", {
    method: "POST",
    cookie: session.cookie,
    body: { code: totpAt(secret) }
  });
  assert.equal(enabled.status, 200);
  const { recoveryCodes } = await enabled.json();
  assert.equal(recoveryCodes.length, 10);

  const step1 = await login(email, "cavalo-bateria-grampo-correto");
  assert.equal(step1.response.status, 200);
  assert.equal(step1.body.mfaRequired, true);
  assert.equal(step1.cookie, "", "sem cookie antes do segundo fator");

  const wrong = await call("/api/auth/login/mfa", { method: "POST", body: { mfaToken: step1.body.mfaToken, code: "123456" } });
  assert.equal(wrong.status, 401);

  const nextStepCode = totpAt(secret, Date.now() + 30_000);
  const ok = await call("/api/auth/login/mfa", { method: "POST", body: { mfaToken: step1.body.mfaToken, code: nextStepCode } });
  assert.equal(ok.status, 200);
  assert.ok(cookieOf(ok).startsWith("it_guardian_session="));

  const replay = await call("/api/auth/login/mfa", { method: "POST", body: { mfaToken: step1.body.mfaToken, code: nextStepCode } });
  assert.equal(replay.status, 401, "o mesmo codigo nao pode ser usado duas vezes");

  const viaRecovery = await call("/api/auth/login/mfa", {
    method: "POST",
    body: { mfaToken: step1.body.mfaToken, recoveryCode: recoveryCodes[0] }
  });
  assert.equal(viaRecovery.status, 200);
  const reused = await call("/api/auth/login/mfa", {
    method: "POST",
    body: { mfaToken: step1.body.mfaToken, recoveryCode: recoveryCodes[0] }
  });
  assert.equal(reused.status, 401);

  const notAChallenge = await call("/api/auth/login/mfa", { method: "POST", body: { mfaToken: "lixo", code: nextStepCode } });
  assert.equal(notAChallenge.status, 401);
});

test("vida maxima absoluta da sessao e imposta mesmo com o JWT ainda valido", async () => {
  const { cookie } = await login(adminEmail, adminPassword);
  assert.equal((await call("/api/auth/me", { cookie })).status, 200);
  await query("UPDATE auth_sessions SET absolute_expires_at = NOW() - INTERVAL '1 minute'");
  assert.equal((await call("/api/auth/me", { cookie })).status, 401);
});

test("lista, revoga uma e revoga as outras sessoes do proprio usuario", async () => {
  const a = await login(adminEmail, adminPassword);
  const b = await login(adminEmail, adminPassword);
  const listed = await (await call("/api/auth/sessions", { cookie: a.cookie })).json();
  assert.ok(listed.sessions.length >= 2);
  assert.equal(listed.sessions.filter((item) => item.current).length, 1);

  const revokeOthers = await call("/api/auth/sessions/revoke-others", { method: "POST", cookie: a.cookie });
  assert.equal(revokeOthers.status, 200);
  assert.equal((await call("/api/auth/me", { cookie: b.cookie })).status, 401);
  assert.equal((await call("/api/auth/me", { cookie: a.cookie })).status, 200);
});

test("o seed de demonstracao nunca sobrescreve uma conta existente", async () => {
  const admin = await findUserByEmail(adminEmail);
  const { setUserPassword } = await import("../src/repositories/userSecurityRepository.js");
  const { hashPassword } = await import("../src/security/passwordHasher.js");
  await setUserPassword(admin.id, await hashPassword("minha-frase-secreta-longa-5"));
  await seedDefaultAdmin();
  assert.equal((await login(adminEmail, "minha-frase-secreta-longa-5")).response.status, 200);
  assert.equal((await login(adminEmail, "123456")).response.status, 401);
  await setUserPassword(admin.id, await hashPassword(adminPassword));
});

test("o escopo de clientes do tecnico vem do vinculo, nunca do nome de exibicao", async () => {
  const admin = (await login(adminEmail, adminPassword)).cookie;
  const { email, body } = await createManagedUser(admin, { name: "Nome Em Comum", mustChangePassword: false });

  await query("INSERT INTO technicians (id, name, email, allowed_client_ids, active) VALUES ($1, $2, $3, $4::jsonb, TRUE)", [
    "tech-homonimo",
    "Nome Em Comum",
    "outra.pessoa@empresa.test",
    JSON.stringify(["cliente-restrito"])
  ]);
  const { cookie } = await login(email, "cavalo-bateria-grampo-correto");
  const withoutLink = await (await call("/api/auth/me", { cookie })).json();
  assert.deepEqual(withoutLink.user.allowedClientIds, [], "homonimo nao herda o escopo");

  await query("UPDATE technicians SET user_id = $1 WHERE id = 'tech-homonimo'", [body.user.id]);
  const withLink = await (await call("/api/auth/me", { cookie })).json();
  assert.deepEqual(withLink.user.allowedClientIds, ["cliente-restrito"]);
});

test("cadastro inicial publico fica desativado quando ja existe administrador", async () => {
  const response = await call("/api/auth/register", {
    method: "POST",
    body: { name: "Intruso", email: "intruso@empresa.test", password: "uma-frase-longa-e-unica-33" }
  });
  assert.equal(response.status, 403);
});

test("sessao aberta direto pelo servico funciona como Bearer (clientes de API)", async () => {
  const admin = await findUserByEmail(adminEmail);
  const { token } = await startSession(admin);
  assert.equal((await call("/api/auth/me", { token })).status, 200);
});
