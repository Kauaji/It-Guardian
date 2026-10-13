import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "password-recovery-integration-secret-32-chars";
process.env.NODE_ENV = "test";
process.env.AUTH_RATE_LIMIT_MAX = "1000";
process.env.LOGIN_LOCKOUT_THRESHOLD = "3";
process.env.PASSWORD_HASH_COST = "10";
process.env.FRONTEND_URL = "https://app.empresa.test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { totpAt } = await import("../src/domain/totp.js");
const { clearTestOutbox, readTestOutbox } = await import("../src/services/mailService.js");

const origin = "http://localhost:5173";
const adminEmail = "admin@itguardian.local";
const adminPassword = "123456";
const initialPassword = "cavalo-bateria-grampo-correto";
const newPassword = "girafa-lanterna-tijolo-sereno";

let server;
let baseUrl;

test.before(async () => {
  await initializeRuntime();
  server = await new Promise((resolve) => {
    const instance = createApp().listen(0, "127.0.0.1", () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.beforeEach(() => clearTestOutbox());

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
});

async function call(path, { method = "GET", cookie, body, headers = {} } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", origin, ...(cookie ? { cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

const cookieOf = (response) => (response.headers.get("set-cookie") || "").split(";")[0];

async function login(email, password) {
  const response = await call("/api/auth/login", { method: "POST", body: { email, password } });
  return { response, cookie: cookieOf(response), body: await response.json().catch(() => ({})) };
}

let adminCookiePromise;
function adminCookie() {
  adminCookiePromise ||= login(adminEmail, adminPassword).then((result) => result.cookie);
  return adminCookiePromise;
}

async function createUser(overrides = {}) {
  const email = `pessoa.${Math.random().toString(36).slice(2, 10)}@empresa.test`;
  const response = await call("/api/users", {
    method: "POST",
    cookie: await adminCookie(),
    body: { name: "Pessoa Teste", email, password: initialPassword, role: "operator", mustChangePassword: false, ...overrides }
  });
  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  return { email, id: (await response.json()).user.id };
}

const forgot = (email) => call("/api/auth/password/forgot", { method: "POST", body: { email } });
const reset = (token, password) => call("/api/auth/password/reset", { method: "POST", body: { token, newPassword: password } });

/** Token do ultimo e-mail enviado para o endereco (esta no fragmento do link, nunca na query). */
function tokenFromOutbox(email) {
  const message = [...readTestOutbox()].reverse().find((item) => item.to === email);
  assert.ok(message, `nenhum e-mail enviado para ${email}`);
  const match = message.text.match(/https:\/\/app\.empresa\.test\/redefinir-senha#token=([A-Za-z0-9_-]{43})/);
  assert.ok(match, `link de redefinicao nao encontrado no e-mail:\n${message.text}`);
  return match[1];
}

test("GET /api/auth/options informa que a recuperacao por e-mail esta disponivel", async () => {
  const response = await call("/api/auth/options");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { passwordReset: { enabled: true } });
});

test("esqueci a senha: conta existente recebe e-mail com link de uso unico; resposta e neutra", async () => {
  const { email } = await createUser();
  const response = await forgot(email);
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.match(body.message, /Se o e-mail estiver cadastrado/);

  const outbox = readTestOutbox();
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, email);
  assert.match(outbox[0].subject, /Redefini/);
  assert.match(outbox[0].text, /30 minutos/);
  assert.match(outbox[0].html, /redefinir-senha#token=/);
  assert.ok(!/\?token=/.test(outbox[0].text), "o token nunca vai na query string");
});

test("o link usa a URL configurada e ignora cabecalhos de host forjados", async () => {
  const { email } = await createUser();
  const response = await call("/api/auth/password/forgot", {
    method: "POST",
    body: { email },
    headers: { "x-forwarded-host": "atacante.example", "x-forwarded-proto": "https" }
  });
  assert.equal(response.status, 202);
  const [message] = readTestOutbox();
  assert.ok(message.text.includes("https://app.empresa.test/redefinir-senha#token="));
  assert.ok(!message.text.includes("atacante.example"));
});

test("e-mail desconhecido e conta inativa respondem igual e nao enviam nada", async () => {
  const known = await createUser();
  const knownBody = await (await forgot(known.email)).json();
  clearTestOutbox();

  const unknown = await forgot("ninguem@empresa.test");
  assert.equal(unknown.status, 202);
  assert.deepEqual(await unknown.json(), knownBody, "mesma resposta para quem existe e quem nao existe");

  const inactive = await createUser();
  const deactivated = await call(`/api/users/${inactive.id}`, { method: "DELETE", cookie: await adminCookie() });
  assert.equal(deactivated.status, 200, "desativar usuario falhou");
  clearTestOutbox();
  assert.equal((await forgot(inactive.email)).status, 202);
  assert.equal(readTestOutbox().length, 0, "conta inativa nao recebe link");
});

test("pedido sem e-mail valido e recusado com 400", async () => {
  assert.equal((await call("/api/auth/password/forgot", { method: "POST", body: {} })).status, 400);
  assert.equal((await forgot("isto-nao-e-email")).status, 400);
});

test("limite por conta: depois de 3 pedidos na janela nao envia mais e-mails (resposta continua neutra)", async () => {
  const { email } = await createUser();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal((await forgot(email)).status, 202);
  }
  assert.equal(readTestOutbox().filter((item) => item.to === email).length, 3);
});

test("redefinir: troca a senha, derruba sessoes, destrava a conta e o token so vale uma vez", async () => {
  const { email } = await createUser();
  const before = await login(email, initialPassword);
  assert.equal(before.response.status, 200);

  // Trava a conta com tentativas erradas (limite do teste = 3).
  for (let index = 0; index < 3; index += 1) await login(email, "senha-errada-qualquer-1");
  assert.equal((await login(email, initialPassword)).response.status, 429);

  await forgot(email);
  const token = tokenFromOutbox(email);

  const done = await reset(token, newPassword);
  assert.equal(done.status, 200);
  assert.deepEqual(await done.json(), { ok: true });

  assert.equal((await call("/api/auth/me", { cookie: before.cookie })).status, 401, "sessao antiga foi revogada");
  assert.equal((await login(email, initialPassword)).response.status, 401, "senha antiga nao funciona");
  assert.equal((await login(email, newPassword)).response.status, 200, "senha nova funciona e a conta foi destravada");

  const again = await reset(token, "outra-senha-longa-e-diferente-9");
  assert.equal(again.status, 400);
  assert.equal((await again.json()).code, "RESET_TOKEN_INVALID");

  const confirmation = readTestOutbox()
    .filter((item) => item.to === email)
    .at(-1);
  assert.match(confirmation.subject, /senha .* alterada/i, "aviso de seguranca apos a troca");
  assert.ok(!/redefinir-senha#token/.test(confirmation.text));
});

test("pedir um novo link invalida o anterior", async () => {
  const { email } = await createUser();
  await forgot(email);
  const first = tokenFromOutbox(email);
  await forgot(email);
  const second = tokenFromOutbox(email);
  assert.notEqual(first, second);

  assert.equal((await reset(first, newPassword)).status, 400);
  assert.equal((await reset(second, newPassword)).status, 200);
});

test("senha fraca ou igual a atual e recusada sem gastar o token", async () => {
  const { email } = await createUser();
  await forgot(email);
  const token = tokenFromOutbox(email);

  const weak = await reset(token, "12345678");
  assert.equal(weak.status, 400);
  assert.equal((await weak.json()).code, "WEAK_PASSWORD");

  const sameAsCurrent = await reset(token, initialPassword);
  assert.equal(sameAsCurrent.status, 400);
  assert.equal((await sameAsCurrent.json()).code, "PASSWORD_REUSED");

  assert.equal((await reset(token, newPassword)).status, 200, "o token continua valido depois das recusas");
});

test("token invalido, malformado ou expirado responde sempre o mesmo erro generico", async () => {
  const { email } = await createUser();
  await forgot(email);
  const token = tokenFromOutbox(email);
  await query("UPDATE auth_action_tokens SET expires_at = $2 WHERE user_id = (SELECT id FROM users WHERE email = $1)", [
    email,
    new Date(Date.now() - 60000).toISOString()
  ]);

  const answers = [];
  for (const candidate of [token, "x".repeat(43), "curto", ""]) {
    const response = await reset(candidate, newPassword);
    assert.equal(response.status, 400);
    answers.push(await response.json());
  }
  for (const answer of answers) {
    assert.equal(answer.code, "RESET_TOKEN_INVALID");
    assert.equal(answer.message, answers[0].message);
  }
});

test("o banco guarda so o hash do token, nunca o token", async () => {
  const { email } = await createUser();
  await forgot(email);
  const token = tokenFromOutbox(email);
  const rows = (await query("SELECT token_hash, purpose FROM auth_action_tokens")).rows;
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.token_hash !== token && !row.token_hash.includes(token)));
  assert.ok(rows.every((row) => row.purpose === "password_reset"));
});

test("quem tem MFA continua precisando do segundo fator depois de redefinir a senha", async () => {
  const { email } = await createUser();
  const session = await login(email, initialPassword);
  const { secret } = await (await call("/api/auth/mfa/setup", { method: "POST", cookie: session.cookie })).json();
  const enabled = await call("/api/auth/mfa/enable", { method: "POST", cookie: session.cookie, body: { code: totpAt(secret) } });
  assert.equal(enabled.status, 200);

  await forgot(email);
  assert.equal((await reset(tokenFromOutbox(email), newPassword)).status, 200);

  const afterReset = await login(email, newPassword);
  assert.equal(afterReset.response.status, 200);
  assert.equal(afterReset.body.mfaRequired, true, "redefinir a senha nao pode desligar o MFA");
  assert.equal(afterReset.cookie, "", "sem sessao ate informar o codigo");
});

test("a redefinicao fica na auditoria sem registrar o token", async () => {
  const { email } = await createUser();
  await forgot(email);
  const token = tokenFromOutbox(email);
  await reset(token, newPassword);

  const logs = (await query("SELECT type, message, meta FROM audit_logs WHERE type LIKE 'auth_password_reset%'")).rows;
  const types = new Set(logs.map((row) => row.type));
  assert.ok(types.has("auth_password_reset_requested"));
  assert.ok(types.has("auth_password_reset_completed"));
  assert.ok(!JSON.stringify(logs).includes(token), "o token nunca aparece na auditoria");
});

test("admin pode enviar o link de redefinicao a um usuario (requer permissao de administrador)", async () => {
  const { email, id: userId } = await createUser();

  const anonymous = await call(`/api/users/${userId}/send-reset-link`, { method: "POST" });
  assert.equal(anonymous.status, 401);

  const sent = await call(`/api/users/${userId}/send-reset-link`, { method: "POST", cookie: await adminCookie() });
  assert.equal(sent.status, 200);
  assert.deepEqual(await sent.json(), { sent: true });
  assert.equal((await reset(tokenFromOutbox(email), newPassword)).status, 200);
});

test("dois pedidos simultaneos com o mesmo link: so um vence (consumo atomico)", async () => {
  const { email } = await createUser();
  await forgot(email);
  const token = tokenFromOutbox(email);

  const [first, second] = await Promise.all([reset(token, newPassword), reset(token, "outra-senha-longa-e-diferente-9")]);
  assert.deepEqual([first.status, second.status].sort(), [200, 400]);

  // A senha gravada e a do vencedor, e so uma troca foi auditada.
  const winnerPassword = first.status === 200 ? newPassword : "outra-senha-longa-e-diferente-9";
  assert.equal((await login(email, winnerPassword)).response.status, 200);
  const completed = (
    await query(
      "SELECT COUNT(*) AS total FROM audit_logs WHERE type = 'auth_password_reset_completed' AND message LIKE '%e-mail%' AND user_id = (SELECT id FROM users WHERE email = $1)",
      [email]
    )
  ).rows[0].total;
  assert.equal(Number(completed), 1);
});

test("redefinir revoga explicitamente todas as sessoes no banco (nao so pela versao do token)", async () => {
  const { email, id } = await createUser();
  await login(email, initialPassword);
  await login(email, initialPassword);
  const active = async () =>
    Number((await query("SELECT COUNT(*) AS total FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL", [id])).rows[0].total);
  assert.equal(await active(), 2);

  await forgot(email);
  assert.equal((await reset(tokenFromOutbox(email), newPassword)).status, 200);
  assert.equal(await active(), 0);
});

test("a retencao apaga links vencidos ha mais de 7 dias e preserva os recentes", async () => {
  const { runDataRetention } = await import("../src/jobs/dataRetention.js");
  const { email, id } = await createUser();
  await forgot(email); // link recente e valido
  await query(
    `INSERT INTO auth_action_tokens (id, user_id, purpose, token_hash, expires_at, created_at)
     VALUES ('velho-1', $1, 'password_reset', 'hash-de-um-link-velho', $2, $2)`,
    [id, new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()]
  );

  const outcome = await runDataRetention();
  assert.ok(outcome.removed.authActionTokens >= 1);
  const left = (await query("SELECT token_hash FROM auth_action_tokens WHERE user_id = $1", [id])).rows;
  assert.ok(!left.some((row) => row.token_hash === "hash-de-um-link-velho"));
  assert.equal(left.length, 1, "o link recente continua la");
});
