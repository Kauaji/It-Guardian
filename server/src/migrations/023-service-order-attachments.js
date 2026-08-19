export const migration023ServiceOrderAttachments = {
  id: "023-service-order-attachments",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS service_order_attachments (
        id TEXT PRIMARY KEY,
        service_order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        storage_key TEXT,
        category TEXT NOT NULL DEFAULT 'outro',
        description TEXT,
        uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_service_order_attachments_order
      ON service_order_attachments(service_order_id, uploaded_at DESC);
    `);
  }
};
