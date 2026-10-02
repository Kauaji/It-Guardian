import { resolveDatabaseConfig } from "./config/environment.js";
import { logger } from "./lib/logger.js";
import { gauge } from "./lib/metrics.js";

let poolPromise;
let currentPool = null;

async function createPool() {
  const config = resolveDatabaseConfig();

  if (config.mode === "memory") {
    const { newDb } = await import("pg-mem").catch(() => {
      throw new Error(
        "DATABASE_URL=memory exige o pacote pg-mem (devDependency): ele nao existe em instalacoes de producao (--omit=dev). " +
          "Use um PostgreSQL real fora de dev/teste."
      );
    });
    const db = newDb({ autoCreateForeignKeyIndices: true });
    const { Pool } = db.adapters.createPg();
    return new Pool();
  }

  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: config.connectionString,
    ssl: config.ssl,
    max: config.max,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    idleTimeoutMillis: config.idleTimeoutMillis,
    allowExitOnIdle: config.allowExitOnIdle
  });

  pool.on("error", (error) => {
    logger.error("database_pool_error", { code: error.code, message: error.message });
  });

  currentPool = pool;
  return pool;
}
export function getPool() {
  if (!poolPromise) {
    poolPromise = createPool();
  }

  return poolPromise;
}

export async function query(text, params = []) {
  const pool = await getPool();
  return pool.query(text, params);
}

export async function withTransaction(operation) {
  const pool = await getPool();
  const client = await pool.connect();
  const txQuery = (text, params = []) => client.query(text, params);

  try {
    await client.query("BEGIN");
    const result = await operation(txQuery);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Uma conexao dedicada, sem transacao: necessario para locks de sessao (advisory lock) que precisam de unlock na MESMA conexao. */
export async function withConnection(operation) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    return await operation((text, params = []) => client.query(text, params));
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  if (!poolPromise) return;
  const pool = await poolPromise;
  await pool.end();
  poolPromise = undefined;
  currentPool = null;
}

/** Estatisticas do pool (sem abrir conexao): usadas por /metrics e pelo diagnostico. */
export function getPoolStats() {
  return currentPool ? { total: currentPool.totalCount, idle: currentPool.idleCount, waiting: currentPool.waitingCount } : {};
}

gauge("itguardian_db_pool_connections", "Conexoes do pool do banco por estado.", () => getPoolStats(), "state");
