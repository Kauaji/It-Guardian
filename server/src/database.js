import { resolveDatabaseConfig } from "./config/environment.js";

let poolPromise;

async function createPool() {
  const config = resolveDatabaseConfig();

  if (config.mode === "memory") {
    const { newDb } = await import("pg-mem");
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
    idleTimeoutMillis: config.idleTimeoutMillis
  });

  pool.on("error", (error) => {
    console.error(JSON.stringify({
      level: "error",
      event: "database_pool_error",
      code: error.code,
      message: error.message
    }));
  });

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
