export const migration024ServiceOrderFeedback = {
  id: "024-service-order-feedback",
  async up(db) {
    // service_order_id UNIQUE declarado inline (nao como indice separado) -
    // pg-mem so reconhece um ON CONFLICT (service_order_id) quando existe
    // uma constraint UNIQUE de verdade, nao apenas um indice unico criado
    // via CREATE UNIQUE INDEX.
    await db(`
      CREATE TABLE IF NOT EXISTS service_order_feedback (
        id TEXT PRIMARY KEY,
        service_order_id TEXT NOT NULL UNIQUE REFERENCES service_orders(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL,
        comment TEXT,
        submitted_by_name TEXT,
        submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source TEXT NOT NULL DEFAULT 'internal'
      );
    `);
  }
};
