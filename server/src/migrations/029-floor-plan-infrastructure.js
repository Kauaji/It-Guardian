import { resolveDatabaseConfig } from "../config/environment.js";

export const migration029FloorPlanInfrastructure = {
  id: "029-floor-plan-infrastructure",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS floor_plan_backgrounds (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
        floor_id TEXT NOT NULL UNIQUE REFERENCES floor_plan_floors(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
        byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 8388608),
        sha256 TEXT NOT NULL,
        file_data BYTEA NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`CREATE INDEX IF NOT EXISTS idx_floor_plan_backgrounds_plan ON floor_plan_backgrounds (plan_id);`);
    if (resolveDatabaseConfig().mode === "postgres") {
      // This migration can run after calendar and parts have already been deployed.
      // Enabling RLS here upgrades those existing tables without rewriting history.
      await db("ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;");
      await db("ALTER TABLE part_inventory_movements ENABLE ROW LEVEL SECURITY;");
      await db("ALTER TABLE floor_plan_backgrounds ENABLE ROW LEVEL SECURITY;");
    }
  }
};
