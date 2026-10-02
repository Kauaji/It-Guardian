import { query } from "../../database.js";

async function ensureFloorPlans() {
  await query(`
    CREATE TABLE IF NOT EXISTS floor_plans (
      id TEXT PRIMARY KEY,
      inventory_tab_id TEXT,
      name TEXT NOT NULL,
      company TEXT,
      unit TEXT,
      floor_label TEXT,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'archived')),
      width NUMERIC(10, 2) NOT NULL DEFAULT 1280,
      height NUMERIC(10, 2) NOT NULL DEFAULT 820,
      grid_size NUMERIC(10, 2) NOT NULL DEFAULT 25,
      snap_size NUMERIC(10, 2) NOT NULL DEFAULT 25,
      active_floor_id TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE floor_plans
    ADD COLUMN IF NOT EXISTS inventory_tab_id TEXT;
  `);
}

async function ensureFloorPlanFloors() {
  await query(`
    CREATE TABLE IF NOT EXISTS floor_plan_floors (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      width NUMERIC(10, 2) NOT NULL DEFAULT 1280,
      height NUMERIC(10, 2) NOT NULL DEFAULT 820,
      background_url TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureFloorPlanZones() {
  await query(`
    CREATE TABLE IF NOT EXISTS floor_plan_zones (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
      floor_id TEXT NOT NULL REFERENCES floor_plan_floors(id) ON DELETE CASCADE,
      zone_type TEXT NOT NULL
        CHECK (zone_type IN ('room', 'group', 'segment')),
      group_id TEXT REFERENCES segment_groups(id) ON DELETE SET NULL,
      segment_id TEXT REFERENCES inventory_segments(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#1f7a61',
      geometry JSONB NOT NULL DEFAULT '{}'::jsonb,
      order_index INTEGER NOT NULL DEFAULT 0,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureFloorPlanObjects() {
  await query(`
    CREATE TABLE IF NOT EXISTS floor_plan_objects (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
      floor_id TEXT NOT NULL REFERENCES floor_plan_floors(id) ON DELETE CASCADE,
      object_type TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'asset',
      label TEXT NOT NULL,
      linked_asset_id TEXT,
      group_id TEXT REFERENCES segment_groups(id) ON DELETE SET NULL,
      segment_id TEXT REFERENCES inventory_segments(id) ON DELETE SET NULL,
      x NUMERIC(10, 2) NOT NULL DEFAULT 0,
      y NUMERIC(10, 2) NOT NULL DEFAULT 0,
      width NUMERIC(10, 2) NOT NULL DEFAULT 80,
      height NUMERIC(10, 2) NOT NULL DEFAULT 56,
      rotation NUMERIC(10, 2) NOT NULL DEFAULT 0,
      z NUMERIC(10, 2) NOT NULL DEFAULT 0,
      height_3d NUMERIC(10, 2) NOT NULL DEFAULT 36,
      color TEXT NOT NULL DEFAULT '#1f7a61',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureFloorPlanConnectionPoints() {
  await query(`
    CREATE TABLE IF NOT EXISTS floor_plan_connection_points (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
      floor_id TEXT NOT NULL REFERENCES floor_plan_floors(id) ON DELETE CASCADE,
      point_type TEXT NOT NULL
        CHECK (point_type IN ('network', 'power')),
      label TEXT NOT NULL,
      linked_object_id TEXT REFERENCES floor_plan_objects(id) ON DELETE SET NULL,
      x NUMERIC(10, 2) NOT NULL DEFAULT 0,
      y NUMERIC(10, 2) NOT NULL DEFAULT 0,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureFloorPlanCableRoutes() {
  await query(`
    CREATE TABLE IF NOT EXISTS floor_plan_cable_routes (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
      floor_id TEXT NOT NULL REFERENCES floor_plan_floors(id) ON DELETE CASCADE,
      route_type TEXT NOT NULL
        CHECK (route_type IN ('network', 'power')),
      label TEXT NOT NULL,
      source_point_id TEXT REFERENCES floor_plan_connection_points(id) ON DELETE SET NULL,
      target_point_id TEXT REFERENCES floor_plan_connection_points(id) ON DELETE SET NULL,
      path JSONB NOT NULL DEFAULT '[]'::jsonb,
      color TEXT NOT NULL DEFAULT '#2563eb',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function ensureFloorPlansSchema() {
  await ensureFloorPlans();
  await ensureFloorPlanFloors();
  await ensureFloorPlanZones();
  await ensureFloorPlanObjects();
  await ensureFloorPlanConnectionPoints();
  await ensureFloorPlanCableRoutes();
}
