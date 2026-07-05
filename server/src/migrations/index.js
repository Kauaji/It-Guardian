import { withTransaction } from "../database.js";
import { resolveDatabaseConfig } from "../config/environment.js";
import { migration001RuntimeFoundation } from "./001-runtime-foundation.js";
import { migration002UserPreferences } from "./002-user-preferences.js";

export const migrations = [
  migration001RuntimeFoundation,
  migration002UserPreferences
];

export async function runMigrations() {
  await withTransaction(async (db) => {
    await db(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    if (resolveDatabaseConfig().mode === "postgres") {
      await db("SELECT pg_advisory_xact_lock($1)", [813_724_601]);
    }

    for (const migration of migrations) {
      const applied = await db(
        "SELECT id FROM schema_migrations WHERE id = $1",
        [migration.id]
      );
      if (applied.rowCount) continue;

      await migration.up(db);
      await db(
        "INSERT INTO schema_migrations (id) VALUES ($1)",
        [migration.id]
      );
    }
  });
}
