import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";
import { listRoutes } from "../test-support/routes.mjs";

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "route-matrix-integration-secret-with-32-chars";
process.env.NODE_ENV = "test";
process.env.AUTH_RATE_LIMIT_MAX = "100000";
process.env.API_RATE_LIMIT_PER_MINUTE = "100000";
process.env.API_MUTATION_RATE_LIMIT_PER_MINUTE = "100000";
process.env.API_ANONYMOUS_RATE_LIMIT_PER_MINUTE = "100000";
process.env.API_ANONYMOUS_MUTATION_RATE_LIMIT_PER_MINUTE = "100000";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");

/**
 * MATRIZ DE AUTORIZACAO: percorre TODAS as rotas registradas no Express e
 * prova duas coisas --
 *   1. sem login, toda rota responde 401, salvo as listadas como publicas
 *      (login, formulario publico, health, agente com token proprio...);
 *   2. com um usuario autenticado SEM NENHUMA permissao, toda rota responde
 *      403, salvo as listadas como "so autenticacao" (o proprio perfil).
 * Uma rota nova esquecida sem requireAuth/requirePermission quebra este teste.
 */

// metodo + caminho -> status aceitos sem login
const publicRoutes = new Map([
  ["GET /health", [200]],
  ["GET /api/health", [200]],
  ["GET /health/live", [200]],
  ["GET /health/ready", [200]],
  ["GET /metrics", [404]], // sem METRICS_TOKEN a rota nao existe
  ["POST /api/auth/login", [400, 401]],
  ["POST /api/auth/login/mfa", [401]],
  ["POST /api/auth/register", [400, 403]],
  ["GET /api/public/support-options", [200]],
  ["GET /api/public/machine-context", [400, 404]],
  ["POST /api/public/service-orders", [400]],
  ["GET /api/public/service-orders/track/:token", [404]],
  ["GET /api/devices/public/:id", [404]],
  ["POST /api/collector/activate", [400]]
]);

// Rotas do coletor/cron: autenticam com token do agente ou segredo proprio.
const ownAuthPrefixes = [
  "/api/agents/",
  "/agent/",
  "/api/preventive-automation-plans/process-due/cron",
  "/api/maintenance/retention/cron"
];

// So autenticacao (sem permissao especifica): dados do proprio usuario.
const authenticatedOnly = new Set([
  "GET /api/auth/me",
  "POST /api/auth/logout",
  "POST /api/auth/password",
  "GET /api/auth/sessions",
  "POST /api/auth/sessions/revoke-others",
  "DELETE /api/auth/sessions/:id",
  "GET /api/auth/mfa/status",
  "POST /api/auth/mfa/setup",
  "POST /api/auth/mfa/enable",
  "POST /api/auth/mfa/disable",
  "POST /api/auth/mfa/recovery-codes",
  "GET /api/preferences/:key",
  "PUT /api/preferences/:key",
  "GET /api/system-settings" // o app inteiro precisa do modo do sistema para renderizar
]);

const lastRoutes = /\/api\/auth\/(logout|sessions|password|mfa)/;

function isOwnAuth(path) {
  return ownAuthPrefixes.some((prefix) => path.startsWith(prefix));
}

test("toda rota exige login e permissao, salvo as excecoes explicitas", async (t) => {
  await initializeRuntime();
  const app = createApp();
  const routes = listRoutes(app);
  assert.ok(routes.length > 250, `enumerou rotas demais poucas (${routes.length}); o enumerador quebrou?`);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await closeDatabase();
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:5173" },
    body: JSON.stringify({ email: "sem.permissao@itguardian.local", password: "123456" })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];

  const request = (route, withCookie) =>
    fetch(baseUrl + route.path.replace(/:[A-Za-z]+/g, "id-de-teste"), {
      method: route.method,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
        ...(withCookie ? { cookie } : {})
      },
      body: ["POST", "PUT", "PATCH", "DELETE"].includes(route.method) ? "{}" : undefined
    });

  const ordered = [...routes].sort((a, b) => Number(lastRoutes.test(a.path)) - Number(lastRoutes.test(b.path)));
  const failures = [];
  const seenPublic = new Set();
  const seenAuthOnly = new Set();

  for (const route of ordered) {
    const key = `${route.method} ${route.path}`;

    const anonymous = await request(route, false);
    if (publicRoutes.has(key)) {
      seenPublic.add(key);
      if (!publicRoutes.get(key).includes(anonymous.status)) {
        failures.push(`${key}: publica deveria responder ${publicRoutes.get(key)} mas respondeu ${anonymous.status}`);
      }
      continue;
    }
    if (isOwnAuth(route.path)) {
      if (![200, 400, 401, 403, 503].includes(anonymous.status) || anonymous.status >= 500 && anonymous.status !== 503) {
        failures.push(`${key}: rota de agente/cron respondeu ${anonymous.status} sem credencial`);
      }
      continue;
    }
    if (anonymous.status !== 401) {
      failures.push(`${key}: sem login deveria ser 401, foi ${anonymous.status}`);
      continue;
    }

    if (authenticatedOnly.has(key)) {
      seenAuthOnly.add(key);
      continue;
    }
    const noPermission = await request(route, true);
    if (noPermission.status !== 403) {
      failures.push(`${key}: usuario sem permissao deveria receber 403, recebeu ${noPermission.status}`);
    }
  }

  for (const key of publicRoutes.keys()) {
    if (!seenPublic.has(key)) failures.push(`excecao publica obsoleta (a rota nao existe mais): ${key}`);
  }
  for (const key of authenticatedOnly) {
    if (!seenAuthOnly.has(key)) failures.push(`excecao "so autenticacao" obsoleta: ${key}`);
  }

  assert.deepEqual(failures, [], `\n${failures.join("\n")}\n`);
});
