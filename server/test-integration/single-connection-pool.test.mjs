import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

// Regressao: em serverless (Vercel) o pool tem UMA conexao. Qualquer codigo que segure essa conexao e peca outra ao
// pool trava ate o timeout ("timeout exceeded when trying to connect") -- foi o que derrubou o login em producao.
await useTestDatabase();
process.env.DB_POOL_MAX = "1";
process.env.DB_CONNECTION_TIMEOUT_MS = "4000";
process.env.JWT_SECRET = "single-connection-secret-with-32-characters";
process.env.NODE_ENV = "test";
process.env.ENABLE_DEMO_SEED = "true";

const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { runDataRetention } = await import("../src/jobs/dataRetention.js");
const { getMigrationStatus } = await import("../src/migrations/index.js");

test.after(closeDatabase);

test("a inicializacao completa (esquema legado + migracoes + seeds) funciona com pool de 1 conexao", async () => {
  await initializeRuntime();
  const status = await getMigrationStatus();
  assert.equal(status.legacySchemaApplied, true);
  assert.deepEqual(status.pending, []);
});

test("consultas e retencao seguem funcionando com pool de 1 conexao", async () => {
  assert.equal((await query("SELECT 1 AS ok")).rows[0].ok, 1);
  const result = await runDataRetention();
  assert.ok(result.removed || result.skipped);
});
