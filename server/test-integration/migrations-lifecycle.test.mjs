import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
process.env.JWT_SECRET = "migrations-lifecycle-secret-with-32-chars";
process.env.NODE_ENV = "test";

const { closeDatabase, query } = await import("../src/database.js");
const { getMigrationsMode } = await import("../src/config/environment.js");
const { LEGACY_SCHEMA_MARKER, initializeDatabase } = await import("../src/schema/legacyBootstrap.js");
const { assertSchemaUpToDate, getMigrationStatus, migrations, runMigrations } = await import("../src/migrations/index.js");

test.after(closeDatabase);

test("banco virgem: tudo pendente e o modo check recusa subir", async () => {
  const status = await getMigrationStatus();
  assert.equal(status.legacySchemaApplied, false);
  assert.equal(status.pending.length, migrations.length);
  await assert.rejects(assertSchemaUpToDate(), /desatualizado.*db:migrate/s);
});

test("esquema legado roda uma vez e as proximas partidas o pulam", async () => {
  const first = await initializeDatabase();
  assert.equal(first.skipped, false);
  const marker = await query("SELECT id FROM schema_migrations WHERE id = $1", [LEGACY_SCHEMA_MARKER]);
  assert.equal(marker.rowCount, 1);

  // Prova de que nao reexecuta: remove uma tabela legada; se o DDL rodasse de novo ela voltaria.
  await query("DROP TABLE alert_comments");
  const second = await initializeDatabase();
  assert.equal(second.skipped, true);
  const gone = await query("SELECT 1 FROM information_schema.tables WHERE table_name = 'alert_comments'");
  assert.equal(gone.rowCount, 0, "o esquema legado foi reexecutado apesar do marcador");
});

test("migracoes aplicam, o status zera e o modo check passa", async () => {
  await runMigrations();
  const status = await assertSchemaUpToDate();
  assert.deepEqual(status.pending, []);
  assert.equal(status.migrations.every((migration) => migration.applied), true);
});

test("migracao faltando volta a aparecer como pendente", async () => {
  const last = migrations[migrations.length - 1].id;
  await query("DELETE FROM schema_migrations WHERE id = $1", [last]);
  const status = await getMigrationStatus();
  assert.deepEqual(status.pending, [last]);
  await assert.rejects(assertSchemaUpToDate(), new RegExp(last));
  await query("INSERT INTO schema_migrations (id) VALUES ($1)", [last]);
});

test("MIGRATIONS_MODE aceita auto|check|skip e rejeita valor desconhecido", () => {
  assert.equal(getMigrationsMode({}), "auto");
  assert.equal(getMigrationsMode({ MIGRATIONS_MODE: " CHECK " }), "check");
  assert.equal(getMigrationsMode({ MIGRATIONS_MODE: "skip" }), "skip");
  assert.throws(() => getMigrationsMode({ MIGRATIONS_MODE: "chek" }), /MIGRATIONS_MODE invalido/);
});
