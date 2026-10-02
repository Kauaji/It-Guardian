import { query } from "../../database.js";
import { queryIgnoringDuplicateConstraint } from "./helpers.js";

async function ensureInventoryVisualMaps() {
  await query(`
    CREATE TABLE IF NOT EXISTS inventory_visual_maps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      environment_id TEXT,
      group_id TEXT REFERENCES segment_groups(id) ON DELETE SET NULL,
      segment_id TEXT REFERENCES inventory_segments(id) ON DELETE SET NULL,
      floor_label TEXT,
      width NUMERIC(10, 2) NOT NULL DEFAULT 30,
      depth NUMERIC(10, 2) NOT NULL DEFAULT 20,
      scale NUMERIC(10, 2) NOT NULL DEFAULT 1,
      notes TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureInventoryVisualMapObjects() {
  await query(`
    CREATE TABLE IF NOT EXISTS inventory_visual_map_objects (
      id TEXT PRIMARY KEY,
      map_id TEXT NOT NULL REFERENCES inventory_visual_maps(id) ON DELETE CASCADE,
      layer TEXT NOT NULL DEFAULT 'assets'
        CHECK (layer IN ('structure', 'assets', 'infrastructure', 'electrical')),
      preset_type TEXT NOT NULL,
      label TEXT NOT NULL,
      linked_asset_id TEXT,
      position_x NUMERIC(10, 2) NOT NULL DEFAULT 0,
      position_y NUMERIC(10, 2) NOT NULL DEFAULT 0,
      position_z NUMERIC(10, 2) NOT NULL DEFAULT 0,
      rotation_x NUMERIC(10, 2) NOT NULL DEFAULT 0,
      rotation_y NUMERIC(10, 2) NOT NULL DEFAULT 0,
      rotation_z NUMERIC(10, 2) NOT NULL DEFAULT 0,
      width NUMERIC(10, 2) NOT NULL DEFAULT 1,
      depth NUMERIC(10, 2) NOT NULL DEFAULT 1,
      height NUMERIC(10, 2) NOT NULL DEFAULT 1,
      color TEXT NOT NULL DEFAULT '#1f7a61',
      notes TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE inventory_visual_map_objects
    DROP CONSTRAINT IF EXISTS inventory_visual_map_objects_layer_check;
  `);

  await queryIgnoringDuplicateConstraint(`
    ALTER TABLE inventory_visual_map_objects
    ADD CONSTRAINT inventory_visual_map_objects_layer_check
    CHECK (layer IN ('structure', 'assets', 'infrastructure', 'electrical'));
  `);
}

async function ensureInventoryVisualMapConnections() {
  await query(`
    CREATE TABLE IF NOT EXISTS inventory_visual_map_connections (
      id TEXT PRIMARY KEY,
      map_id TEXT NOT NULL REFERENCES inventory_visual_maps(id) ON DELETE CASCADE,
      layer TEXT NOT NULL
        CHECK (layer IN ('infrastructure', 'electrical')),
      connection_type TEXT NOT NULL,
      label TEXT,
      source_object_id TEXT REFERENCES inventory_visual_map_objects(id) ON DELETE SET NULL,
      target_object_id TEXT REFERENCES inventory_visual_map_objects(id) ON DELETE SET NULL,
      source_asset_id TEXT,
      target_asset_id TEXT,
      points_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      color TEXT,
      thickness NUMERIC NOT NULL DEFAULT 2,
      dashed BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function ensureVisualMapsSchema() {
  await ensureInventoryVisualMaps();
  await ensureInventoryVisualMapObjects();
  await ensureInventoryVisualMapConnections();
}
