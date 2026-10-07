import { query } from "../database.js";
import { logger } from "../lib/logger.js";
import { runLegacySchema } from "./legacy/index.js";

/**
 * O esquema legado (src/schema/legacy/*) roda UMA vez por banco: ao terminar,
 * grava este marcador em schema_migrations e as proximas partidas o pulam
 * (antes, cada cold start reexecutava ~250 DDLs). Como o conjunto esta
 * congelado, mudancas novas de esquema entram como migracao numerada.
 */
export const LEGACY_SCHEMA_MARKER = "000-legacy-schema-frozen";

export async function ensureMigrationsTable(db = query) {
  // O pg-mem recusa `CREATE TABLE IF NOT EXISTS` sobre tabela existente; checar antes serve aos dois motores.
  const exists = await db(
    "SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations' AND table_schema = current_schema()"
  );
  if (exists.rowCount) return;
  await db(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function isLegacySchemaApplied(db = query) {
  const result = await db("SELECT id FROM schema_migrations WHERE id = $1", [LEGACY_SCHEMA_MARKER]);
  return result.rowCount > 0;
}

export async function initializeDatabase() {
  await ensureMigrationsTable();
  if (await isLegacySchemaApplied()) return { skipped: true };

  // ATENCAO: nao segurar uma conexao dedicada (advisory lock) enquanto o esquema roda: em serverless (Vercel) o pool
  // tem UMA conexao, e o esquema usa o pool -- isso trava ate estourar o timeout de conexao. O DDL legado e idempotente
  // (IF NOT EXISTS), entao partidas frias simultaneas podem executa-lo sem risco; so a primeira grava o marcador.
  const startedAt = Date.now();
  await runLegacySchema();
  await query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [LEGACY_SCHEMA_MARKER]);
  logger.info("legacy_schema_applied", { durationMs: Date.now() - startedAt });
  return { skipped: false };
}
