export const migration021ServiceOrderReopen = {
  id: "021-service-order-reopen",
  async up(db) {
    await db(`
      ALTER TABLE service_orders
      ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ;
    `);
    await db(`
      ALTER TABLE service_orders
      ADD COLUMN IF NOT EXISTS reopened_by TEXT REFERENCES users(id) ON DELETE SET NULL;
    `);
    await db(`
      ALTER TABLE service_orders
      ADD COLUMN IF NOT EXISTS reopen_reason TEXT;
    `);
    await db(`
      ALTER TABLE service_orders
      ADD COLUMN IF NOT EXISTS reopen_count INTEGER NOT NULL DEFAULT 0;
    `);
  }
};
