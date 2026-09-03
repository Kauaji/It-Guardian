export const migration028PartsInventory = {
  id: "028-parts-inventory",
  async up(db) {
    await db(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS manufacturer_part_number TEXT,
        ADD COLUMN IF NOT EXISTS serial_number TEXT,
        ADD COLUMN IF NOT EXISTS mac_address TEXT,
        ADD COLUMN IF NOT EXISTS location TEXT,
        ADD COLUMN IF NOT EXISTS minimum_stock NUMERIC NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS condition_status TEXT NOT NULL DEFAULT 'new',
        ADD COLUMN IF NOT EXISTS assigned_asset_id TEXT,
        ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
    await db(`
      CREATE TABLE IF NOT EXISTS part_inventory_movements (
        id TEXT PRIMARY KEY,
        part_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        movement_type TEXT NOT NULL CHECK (movement_type IN ('receipt', 'consumption', 'return', 'adjustment', 'assignment', 'unassignment')),
        quantity NUMERIC NOT NULL CHECK (quantity > 0),
        previous_quantity NUMERIC NOT NULL,
        resulting_quantity NUMERIC NOT NULL CHECK (resulting_quantity >= 0),
        service_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
        asset_id TEXT,
        notes TEXT,
        performed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`CREATE INDEX IF NOT EXISTS idx_part_movements_part_created ON part_inventory_movements (part_id, created_at DESC);`);
    await db(`CREATE INDEX IF NOT EXISTS idx_parts_codes ON products (lower(internal_code), lower(serial_number), lower(mac_address));`);
  }
};
