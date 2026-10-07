import { query } from "../../database.js";
import { queryIgnoringDuplicateConstraint } from "./helpers.js";

async function ensureInventorySegments() {
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
}

async function ensureSegmentGroups() {
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
}

async function ensureInventorySegmentsPart2() {
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
}

async function ensureDeviceSegments() {
  await query(`
    CREATE TABLE IF NOT EXISTS device_segments (
      device_id TEXT PRIMARY KEY,
      segment_id TEXT NOT NULL REFERENCES inventory_segments(id) ON DELETE RESTRICT,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureManualNetworkAssets() {
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
}

async function ensureDeviceMetadata() {
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
}

async function ensureAssetHistory() {
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
}

export async function ensureInventorySchema() {
  await ensureInventorySegments();
  await ensureSegmentGroups();
  await ensureInventorySegmentsPart2();
  await ensureDeviceSegments();
  await ensureManualNetworkAssets();
  await ensureDeviceMetadata();
  await ensureAssetHistory();
}
