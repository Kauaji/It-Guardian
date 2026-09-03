import { randomUUID } from "node:crypto";
import { resolveDatabaseConfig } from "../config/environment.js";

const DEFAULT_PART_CATEGORIES = [
  ["Memória", "#7c3aed"],
  ["Armazenamento", "#2563eb"],
  ["Processador", "#0891b2"],
  ["Placa-mãe", "#0f766e"],
  ["Vídeo", "#db2777"],
  ["Rede", "#16a34a"],
  ["Energia", "#d97706"],
  ["Periféricos", "#64748b"],
  ["Outros", "#475569"]
];

export const migration030OperationalRefinements = {
  id: "030-operational-refinements",
  async up(db) {
    await db(`
      ALTER TABLE service_orders
        ADD COLUMN IF NOT EXISTS assigned_technician_names JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
    const legacyAssignments = await db(`
      SELECT id, assigned_technician_name
      FROM service_orders
      WHERE assigned_technician_name IS NOT NULL
        AND assigned_technician_name <> ''
        AND assigned_technician_names = '[]'::jsonb
    `);
    for (const order of legacyAssignments.rows) {
      await db(
        "UPDATE service_orders SET assigned_technician_names = $2::jsonb WHERE id = $1",
        [order.id, JSON.stringify([order.assigned_technician_name])]
      );
    }

    await db(`
      CREATE TABLE IF NOT EXISTS part_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#475569',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`CREATE UNIQUE INDEX IF NOT EXISTS idx_part_categories_name ON part_categories (lower(name));`);

    for (const [name, color] of DEFAULT_PART_CATEGORIES) {
      await db(
        `INSERT INTO part_categories (id, name, color) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [randomUUID(), name, color]
      );
    }

    await db(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS inventory_state TEXT NOT NULL DEFAULT 'available',
        ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
        ADD COLUMN IF NOT EXISTS source_asset_id TEXT,
        ADD COLUMN IF NOT EXISTS hardware_key TEXT,
        ADD COLUMN IF NOT EXISTS supplier_name TEXT,
        ADD COLUMN IF NOT EXISTS supplier_tax_id TEXT,
        ADD COLUMN IF NOT EXISTS supplier_product_code TEXT,
        ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS discrepancy_status TEXT NOT NULL DEFAULT 'ok',
        ADD COLUMN IF NOT EXISTS discrepancy_details JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
    await db(`CREATE UNIQUE INDEX IF NOT EXISTS idx_products_asset_hardware ON products (source_asset_id, hardware_key) WHERE source_asset_id IS NOT NULL AND hardware_key IS NOT NULL;`);
    await db(`CREATE INDEX IF NOT EXISTS idx_products_discrepancy ON products (discrepancy_status) WHERE discrepancy_status <> 'ok';`);

    await db(`
      CREATE TABLE IF NOT EXISTS part_inventory_imports (
        id TEXT PRIMARY KEY,
        invoice_key TEXT,
        supplier_name TEXT,
        supplier_tax_id TEXT,
        item_count INTEGER NOT NULL DEFAULT 0,
        total_quantity NUMERIC NOT NULL DEFAULT 0,
        imported_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`CREATE UNIQUE INDEX IF NOT EXISTS idx_part_imports_invoice_key ON part_inventory_imports (invoice_key) WHERE invoice_key IS NOT NULL AND invoice_key <> '';`);

    const maintenance = await db(`
      SELECT id
      FROM inventory_segments
      WHERE lower(name) IN ('manutencao', 'manutenção')
      ORDER BY created_at ASC, id ASC
    `);
    const canonicalId = maintenance.rows[0]?.id;
    if (canonicalId) {
      const duplicates = maintenance.rows.slice(1).map((row) => row.id);
      await db("UPDATE inventory_segments SET name = 'Manutenção', group_id = NULL, updated_at = NOW() WHERE id = $1", [canonicalId]);
      for (const duplicateId of duplicates) {
        await db("UPDATE device_segments SET segment_id = $1 WHERE segment_id = $2", [canonicalId, duplicateId]);
        await db("UPDATE maintenance_records SET maintenance_segment_id = $1 WHERE maintenance_segment_id = $2", [canonicalId, duplicateId]);
        await db("DELETE FROM inventory_segments WHERE id = $1", [duplicateId]);
      }
    }

    if (resolveDatabaseConfig().mode === "postgres") {
      await db(`CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_single_maintenance ON inventory_segments ((1)) WHERE lower(name) IN ('manutencao', 'manutenção');`);
      await db("ALTER TABLE part_categories ENABLE ROW LEVEL SECURITY;");
      await db("ALTER TABLE part_inventory_imports ENABLE ROW LEVEL SECURITY;");
    }
  }
};
