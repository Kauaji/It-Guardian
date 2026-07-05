import assert from "node:assert/strict";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;

test("migrações são idempotentes e transações revertem no PostgreSQL real", {
  skip: !databaseUrl
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.DB_SSL = "false";
  process.env.NODE_ENV = "test";

  const { query, withTransaction } = await import("../src/database.js");
  const { initializeDatabase } = await import("../src/schema/legacyBootstrap.js");
  const { runMigrations, migrations } = await import("../src/migrations/index.js");

  await initializeDatabase();
  await Promise.all([runMigrations(), runMigrations()]);

  const applied = await query(
    "SELECT id FROM schema_migrations ORDER BY id"
  );
  assert.deepEqual(
    applied.rows.map((row) => row.id),
    migrations.map((migration) => migration.id)
  );

  const preferencesTable = await query(
    "SELECT to_regclass('public.user_preferences') AS table_name"
  );
  assert.equal(preferencesTable.rows[0].table_name, "user_preferences");

  await query("CREATE TABLE IF NOT EXISTS integration_transaction_probe (id TEXT PRIMARY KEY)");
  await assert.rejects(
    withTransaction(async (db) => {
      await db("INSERT INTO integration_transaction_probe (id) VALUES ($1)", ["rollback-probe"]);
      throw new Error("force rollback");
    }),
    /force rollback/
  );
  const probe = await query(
    "SELECT id FROM integration_transaction_probe WHERE id = $1",
    ["rollback-probe"]
  );
  assert.equal(probe.rowCount, 0);
});
