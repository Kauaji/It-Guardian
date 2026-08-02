export const migration011AssetMaintenanceLifecycle = {
  id: "011-asset-maintenance-lifecycle",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS maintenance_records (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        service_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'active',
        original_segment_id TEXT,
        original_segment_name TEXT,
        maintenance_segment_id TEXT,
        started_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        finished_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_records_asset_status
      ON maintenance_records(asset_id, status, started_at);
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_records_order_status
      ON maintenance_records(service_order_id, status, started_at);
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS backup_assignments (
        id TEXT PRIMARY KEY,
        backup_asset_id TEXT NOT NULL,
        service_order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
        original_asset_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        released_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        released_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_backup_assignments_order_status
      ON backup_assignments(service_order_id, status, assigned_at);
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_backup_assignments_asset_status
      ON backup_assignments(backup_asset_id, status, assigned_at);
    `);
  }
};
