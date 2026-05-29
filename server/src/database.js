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
    CREATE TABLE IF NOT EXISTS sectors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS sector_id TEXT REFERENCES sectors(id) ON DELETE SET NULL;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS job_title TEXT;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  await query(`
    UPDATE users
    SET is_admin = TRUE
    WHERE role = 'admin';
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
      removed_at TIMESTAMPTZ,
      removed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS removed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS is_backup BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS backup_status TEXT NOT NULL DEFAULT 'available';
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS backup_order_id TEXT;
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS backup_original_segment_id TEXT;
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS backup_original_segment_name TEXT;
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
    CREATE TABLE IF NOT EXISTS service_orders (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      category TEXT,
      problem_type TEXT,
      asset_id TEXT,
      environment_id TEXT,
      environment_name TEXT,
      requester_name TEXT,
      contact_info TEXT,
      requester_department TEXT,
      requester_extension TEXT,
      related_asset_text TEXT,
      machine_scope TEXT,
      location TEXT,
      source TEXT,
      assigned_technician_name TEXT,
      auto_priority_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      work_notes TEXT,
      diagnosis TEXT,
      solution TEXT,
      parts_used TEXT,
      notes TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    );
  `);

  await query(`
    ALTER TABLE service_orders
    DROP CONSTRAINT IF EXISTS service_orders_status_check;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS problem_type TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS contact_info TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS requester_department TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS requester_extension TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS related_asset_text TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS machine_scope TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS location TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS source TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS auto_priority_enabled BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS service_value NUMERIC(12, 2) NOT NULL DEFAULT 0;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS total_parts_value NUMERIC(12, 2) NOT NULL DEFAULT 0;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS total_value NUMERIC(12, 2) NOT NULL DEFAULT 0;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS backup_asset_id TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS service_performed TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS attendance_notes TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS sector_id TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS sector_name TEXT NOT NULL DEFAULT 'Geral';
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS service_id TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS service_code TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS service_name TEXT;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS service_order_history (
      id TEXT PRIMARY KEY,
      service_order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
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
    CREATE TABLE IF NOT EXISTS service_order_items (
      id TEXT PRIMARY KEY,
      service_order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
      product_id TEXT,
      product_name TEXT NOT NULL,
      quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
      unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      trade_name TEXT NOT NULL,
      legal_name TEXT,
      document TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      contact_name TEXT,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      brand TEXT,
      model TEXT,
      internal_code TEXT,
      asset_tag TEXT,
      quantity NUMERIC NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'un',
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS asset_tag TEXT;
  `);

  await query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS service_catalog (
      id TEXT PRIMARY KEY,
      code TEXT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      default_priority TEXT
        CHECK (default_priority IS NULL OR default_priority IN ('low', 'medium', 'high', 'critical')),
      default_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE service_catalog
    ADD COLUMN IF NOT EXISTS code TEXT;
  `);

  await query(`
    ALTER TABLE service_catalog
    ADD COLUMN IF NOT EXISTS description TEXT;
  `);

  await query(`
    ALTER TABLE service_catalog
    ADD COLUMN IF NOT EXISTS default_priority TEXT
      CHECK (default_priority IS NULL OR default_priority IN ('low', 'medium', 'high', 'critical'));
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS technicians (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT,
      specialty TEXT,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE technicians
    ADD COLUMN IF NOT EXISTS allowed_client_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS problem_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      default_priority TEXT
        CHECK (default_priority IS NULL OR default_priority IN ('low', 'medium', 'high', 'critical')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS priority_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rule_type TEXT NOT NULL DEFAULT 'problem_type'
        CHECK (rule_type IN ('client', 'sector', 'problem_type', 'service', 'category', 'open_time', 'equipment_category')),
      target_value TEXT,
      priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      threshold_hours NUMERIC,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE priority_rules
    DROP CONSTRAINT IF EXISTS priority_rules_rule_type_check;
  `);

  await query(`
    ALTER TABLE priority_rules
    ADD CONSTRAINT priority_rules_rule_type_check
      CHECK (rule_type IN ('client', 'sector', 'problem_type', 'service', 'category', 'open_time', 'equipment_category'));
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

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_orders_status
    ON service_orders (status, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_orders_asset_id
    ON service_orders (asset_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_orders_sector_id
    ON service_orders (sector_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_orders_service_id
    ON service_orders (service_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_order_history_order_id
    ON service_order_history (service_order_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_order_items_order_id
    ON service_order_items (service_order_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_clients_trade_name
    ON clients (lower(trade_name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_products_name
    ON products (lower(name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_products_internal_code
    ON products (lower(internal_code));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_catalog_name
    ON service_catalog (lower(name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_catalog_code
    ON service_catalog (lower(code));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_technicians_name
    ON technicians (lower(name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_problem_types_name
    ON problem_types (lower(name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_priority_rules_type
    ON priority_rules (rule_type, active);
  `);
}
