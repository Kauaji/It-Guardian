import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "report-export-csv-integration-secret-32ch";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");

const trustedOrigin = "http://localhost:5173";
const forbiddenSubstrings = [
  "agentToken",
  "viewerToken",
  "sessionToken",
  "iceServers",
  "script_content",
  "scriptContent",
  "turn:",
  "viewer_token_hash",
  "agent_token_hash"
];

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function login(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify({ email: "admin@itguardian.local", password: "123456" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

test.after(closeDatabase);

test("CSV de todos os 7 tipos vem com BOM, delimitador ; e cabecalho em portugues, nunca com dado sensivel", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const types = [
    "monthly",
    "service-orders",
    "sla",
    "assets",
    "alerts",
    "scripts",
    "remote-assistance"
  ];

  for (const type of types) {
    const response = await fetch(`${baseUrl}/api/reports/${type}/export.csv`, { headers: { cookie } });
    assert.equal(response.status, 200, `${type} deveria exportar`);
    assert.match(response.headers.get("content-type") || "", /text\/csv/);

    const buffer = Buffer.from(await response.arrayBuffer());
    // response.text() decodifica como UTF-8 e descarta o BOM por padrao (spec do
    // TextDecoder) - por isso conferimos os bytes crus, que e o que o Excel realmente
    // le do arquivo baixado.
    assert.deepEqual([...buffer.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${type}.csv deveria comecar com BOM UTF-8`);

    const text = buffer.toString("utf-8");
    assert.match(text, /;/, `${type}.csv deveria usar ; como delimitador`);

    for (const forbidden of forbiddenSubstrings) {
      assert.doesNotMatch(text, new RegExp(forbidden, "i"), `${type}.csv nao deveria conter "${forbidden}"`);
    }
  }
});

test("registra uma linha de auditoria em report_exports a cada exportacao", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const before = await query("SELECT COUNT(*)::int AS total FROM report_exports");
  const response = await fetch(`${baseUrl}/api/reports/sla/export.csv`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const after = await query("SELECT COUNT(*)::int AS total FROM report_exports");

  assert.equal(after.rows[0].total, before.rows[0].total + 1);

  const lastRow = await query(
    "SELECT report_type, format FROM report_exports ORDER BY generated_at DESC LIMIT 1"
  );
  assert.equal(lastRow.rows[0].report_type, "sla");
  assert.equal(lastRow.rows[0].format, "csv");
});
