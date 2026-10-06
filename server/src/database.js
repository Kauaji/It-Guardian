import { resolveDatabaseConfig } from "./config/environment.js";
import { logger } from "./lib/logger.js";
import { gauge } from "./lib/metrics.js";

/** @import { Pool, QueryResult } from "pg" */

/**
 * Executa SQL parametrizado. `Row` e o formato da linha, declarado pelo chamador como
 * `@typedef` de linha de banco (padrao `Record<string, unknown>`); o chamador anota o
 * resultado com `@type {QueryResult<UserRow>}` e `Row` e inferido.
 * @typedef {<Row extends Record<string, unknown> = Record<string, unknown>>(
 *   text: string, params?: readonly unknown[]
 * ) => Promise<QueryResult<Row>>} QueryFn
 */

/** @type {Promise<Pool> | undefined} */
let poolPromise;
/** @type {Pool | null} */
let currentPool = null;

/** @returns {Promise<Pool>} */
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
/**
 * @returns {Promise<Pool>} Pool compartilhado (criado sob demanda).
 */
export function getPool() {
  if (!poolPromise) {
    poolPromise = createPool();
  }

  return poolPromise;
}

/**
 * @template {Record<string, unknown>} [Row=Record<string, unknown>]
 * @param {string} text
 * @param {readonly unknown[]} [params]
 * @returns {Promise<QueryResult<Row>>}
 */
export async function query(text, params = []) {
  const pool = await getPool();
  return pool.query(text, params);
}

/**
 * @template T
 * @param {(tx: QueryFn) => Promise<T>} operation Recebe o `query` da transacao; `COMMIT` ao resolver, `ROLLBACK` ao lancar.
 * @returns {Promise<T>}
 */
export async function withTransaction(operation) {
  const pool = await getPool();
  const client = await pool.connect();
  /** @type {QueryFn} */
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

/**
 * Uma conexao dedicada, sem transacao: necessario para locks de sessao (advisory lock) que precisam de unlock na MESMA conexao.
 *
 * @template T
 * @param {(connectionQuery: QueryFn) => Promise<T>} operation
 * @returns {Promise<T>}
 */
export async function withConnection(operation) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    /** @type {QueryFn} */
    const connectionQuery = (text, params = []) => client.query(text, params);
    return await operation(connectionQuery);
  } finally {
    client.release();
  }
}

/**
 * @returns {Promise<void>}
 */
export async function closeDatabase() {
  if (!poolPromise) return;
  const pool = await poolPromise;
  await pool.end();
  poolPromise = undefined;
  currentPool = null;
}

/**
 * Estatisticas do pool (sem abrir conexao): usadas por /metrics e pelo diagnostico.
 *
 * @returns {{ total: number, idle: number, waiting: number } | {}}
 */
export function getPoolStats() {
  return currentPool ? { total: currentPool.totalCount, idle: currentPool.idleCount, waiting: currentPool.waitingCount } : {};
}

gauge("itguardian_db_pool_connections", "Conexoes do pool do banco por estado.", () => getPoolStats(), "state");
