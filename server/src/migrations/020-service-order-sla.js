export const migration020ServiceOrderSla = {
  id: "020-service-order-sla",
  async up(db) {
    await db(`
      ALTER TABLE service_orders
      ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;
    `);
    await db(`
      ALTER TABLE service_orders
      ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;
    `);
    await db(`
      ALTER TABLE service_orders
      ADD COLUMN IF NOT EXISTS sla_breached_at TIMESTAMPTZ;
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_service_orders_sla_due_at
      ON service_orders(sla_due_at);
    `);

    await db(`
      ALTER TABLE service_order_settings
      ADD COLUMN IF NOT EXISTS sla JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
  }
};
