export const migration022ServiceOrderChecklists = {
  id: "022-service-order-checklists",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS service_order_checklist_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        problem_type_key TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_service_order_checklist_templates_problem_type
      ON service_order_checklist_templates(problem_type_key);
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS service_order_checklist_template_items (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL REFERENCES service_order_checklist_templates(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        description TEXT,
        required BOOLEAN NOT NULL DEFAULT FALSE,
        order_index INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_service_order_checklist_template_items_template
      ON service_order_checklist_template_items(template_id, order_index);
    `);

    // Resultado guarda uma copia (label/description/required/order_index) do item
    // no momento em que o template foi aplicado - assim editar ou remover um item
    // de template depois nao apaga nem corrompe o checklist de uma OS ja criada.
    await db(`
      CREATE TABLE IF NOT EXISTS service_order_checklist_results (
        id TEXT PRIMARY KEY,
        service_order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
        template_item_id TEXT REFERENCES service_order_checklist_template_items(id) ON DELETE SET NULL,
        label TEXT NOT NULL,
        description TEXT,
        required BOOLEAN NOT NULL DEFAULT FALSE,
        order_index INTEGER NOT NULL DEFAULT 0,
        checked BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        checked_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        checked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_service_order_checklist_results_order
      ON service_order_checklist_results(service_order_id, order_index);
    `);

    await db(`
      ALTER TABLE service_order_settings
      ADD COLUMN IF NOT EXISTS require_checklist_before_finish BOOLEAN NOT NULL DEFAULT FALSE;
    `);
  }
};
