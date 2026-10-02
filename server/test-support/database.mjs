import { randomBytes } from "node:crypto";

/**
 * Seleciona o banco de dados de um arquivo de teste.
 *
 * - Sem TEST_PG_ADMIN_URL: usa o pg-mem em memoria (rapido, padrao local).
 * - Com TEST_PG_ADMIN_URL (ex.: postgres://user:pass@127.0.0.1:5432/postgres):
 *   cria um banco descartavel exclusivo para este arquivo de teste e o remove
 *   ao final, para que a mesma suite rode contra um PostgreSQL real, em
 *   paralelo, sem que um arquivo enxergue os dados do outro.
 *
 * Deve ser chamado ANTES de qualquer import dinamico de ../src/*.
 */
export async function useTestDatabase() {
  const adminUrl = process.env.TEST_PG_ADMIN_URL;
  if (!adminUrl) {
    process.env.DATABASE_URL = "memory";
    return { mode: "memory", close: async () => {} };
  }

  const { default: pg } = await import("pg");
  const databaseName = `itg_test_${process.pid}_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${databaseName}`);
  await admin.end();

  const url = new URL(adminUrl);
  url.pathname = `/${databaseName}`;
  process.env.DATABASE_URL = url.toString();
  process.env.DB_SSL = "false";

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    const cleaner = new pg.Client({ connectionString: adminUrl });
    await cleaner.connect();
    try {
      await cleaner.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [databaseName]
      );
      await cleaner.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    } finally {
      await cleaner.end();
    }
  };
  process.once("beforeExit", () => {
    close().catch(() => {});
  });
  return { mode: "postgres", databaseName, close };
}
