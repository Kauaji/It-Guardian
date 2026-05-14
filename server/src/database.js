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

  return new Pool({
    connectionString: config.connectionString,
    ssl: config.ssl
  });
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

async function queryIgnoringDuplicateConstraint(text, params = []) {
  try {
    return await query(text, params);
  } catch (error) {
    if (error.code === "42710" || /already exists/i.test(error.message || "")) {
      return null;
    }

    throw error;
  }
}

export async function initializeDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator'
        CHECK (role IN ('admin', 'operator', 'viewer')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alert_acknowledgements (
      alert_id TEXT PRIMARY KEY,
      acknowledged_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      note TEXT,
      acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS inventory_segments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#1f7a61',
      group_id TEXT,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS segment_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#8b9bb0',
      collapsed BOOLEAN NOT NULL DEFAULT FALSE,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE inventory_segments
    ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#1f7a61';
  `);

  await query(`
    ALTER TABLE inventory_segments
    ADD COLUMN IF NOT EXISTS group_id TEXT;
  `);

  await queryIgnoringDuplicateConstraint(`
    ALTER TABLE inventory_segments
    ADD CONSTRAINT inventory_segments_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES segment_groups(id) ON DELETE SET NULL;
  `);

  await query(`
    ALTER TABLE inventory_segments
    DROP CONSTRAINT IF EXISTS inventory_segments_name_key;
  `);

  await query(`
    DROP INDEX IF EXISTS inventory_segments_name_key;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS device_segments (
      device_id TEXT PRIMARY KEY,
      segment_id TEXT NOT NULL REFERENCES inventory_segments(id) ON DELETE RESTRICT,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS manual_network_assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      asset_tag TEXT NOT NULL,
      ip TEXT NOT NULL,
      mac_address TEXT,
      hostname TEXT,
      identification_mode TEXT NOT NULL DEFAULT 'fixed_ip',
      location TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'offline'
        CHECK (status IN ('online', 'offline', 'problem')),
      last_ping_at TIMESTAMPTZ,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS device_metadata (
      device_id TEXT PRIMARY KEY,
      asset_type TEXT NOT NULL,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS asset_history (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      user_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs (created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alert_acknowledgements_acknowledged_at
    ON alert_acknowledgements (acknowledged_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_device_segments_segment_id
    ON device_segments (segment_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_segments_group_id
    ON inventory_segments (group_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_manual_network_assets_ip
    ON manual_network_assets (ip);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_asset_history_asset_id
    ON asset_history (asset_id, created_at DESC);
  `);
}
