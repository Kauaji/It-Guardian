import { query } from "../../database.js";

async function ensureServiceOrders() {
  await query(`
    CREATE TABLE IF NOT EXISTS service_orders (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      category TEXT,
      problem_type TEXT,
      asset_id TEXT,
      environment_id TEXT,
      environment_name TEXT,
      requester_name TEXT,
      contact_info TEXT,
      requester_department TEXT,
      requester_extension TEXT,
      related_asset_text TEXT,
      machine_scope TEXT,
      location TEXT,
      source TEXT,
      assigned_technician_name TEXT,
      auto_priority_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      work_notes TEXT,
      diagnosis TEXT,
      solution TEXT,
      parts_used TEXT,
      notes TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    );
  `);

  await query(`
    ALTER TABLE service_orders
    DROP CONSTRAINT IF EXISTS service_orders_status_check;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS problem_type TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS contact_info TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS requester_department TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS requester_extension TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS related_asset_text TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS machine_scope TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS location TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS source TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS auto_priority_enabled BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS service_value NUMERIC(12, 2) NOT NULL DEFAULT 0;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS total_parts_value NUMERIC(12, 2) NOT NULL DEFAULT 0;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS total_value NUMERIC(12, 2) NOT NULL DEFAULT 0;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS backup_asset_id TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS service_performed TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS attendance_notes TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS sector_id TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS sector_name TEXT NOT NULL DEFAULT 'Geral';
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS service_id TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS service_code TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS service_name TEXT;
  `);
}

async function ensureAppSettings() {
  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureServiceOrderSettings() {
  await query(`
    CREATE TABLE IF NOT EXISTS service_order_settings (
      id TEXT PRIMARY KEY,
      number_prefix TEXT NOT NULL DEFAULT 'OS',
      use_year BOOLEAN NOT NULL DEFAULT FALSE,
      use_month BOOLEAN NOT NULL DEFAULT FALSE,
      next_number INTEGER,
      auto_priority_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      low_to_medium_hours NUMERIC NOT NULL DEFAULT 24,
      medium_to_high_hours NUMERIC NOT NULL DEFAULT 48,
      high_to_critical_hours NUMERIC NOT NULL DEFAULT 72,
      priority_colors JSONB NOT NULL DEFAULT '{}'::jsonb,
      board_layout TEXT NOT NULL DEFAULT 'horizontal',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    INSERT INTO service_order_settings (id)
    VALUES ('default')
    ON CONFLICT (id) DO NOTHING;
  `);
}

async function ensureServiceOrderStatuses() {
  await query(`
    CREATE TABLE IF NOT EXISTS service_order_statuses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#64748b',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_initial BOOLEAN NOT NULL DEFAULT FALSE,
      is_final BOOLEAN NOT NULL DEFAULT FALSE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    INSERT INTO service_order_statuses (id, name, color, sort_order, is_initial, is_final)
    VALUES
      ('open', 'Aberta', '#2563eb', 0, TRUE, FALSE),
      ('in_progress', 'Em atendimento', '#d97706', 1, FALSE, FALSE),
      ('waiting', 'Aguardando', '#7c3aed', 2, FALSE, FALSE),
      ('closed', 'Finalizada', '#16a34a', 3, FALSE, TRUE)
    ON CONFLICT (id) DO NOTHING;
  `);
}

async function ensureServiceOrderHistory() {
  await query(`
    CREATE TABLE IF NOT EXISTS service_order_history (
      id TEXT PRIMARY KEY,
      service_order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      user_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureServiceOrderItems() {
  await query(`
    CREATE TABLE IF NOT EXISTS service_order_items (
      id TEXT PRIMARY KEY,
      service_order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
      product_id TEXT,
      product_name TEXT NOT NULL,
      quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
      unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureServiceOrderSuggestions() {
  await query(`
    CREATE TABLE IF NOT EXISTS service_order_suggestions (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL UNIQUE REFERENCES alerts(id) ON DELETE CASCADE,
      asset_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      suggested_priority TEXT NOT NULL DEFAULT 'medium',
      suggested_service_id TEXT,
      suggested_problem_type_id TEXT,
      occurrences_count INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      accepted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      accepted_at TIMESTAMPTZ,
      rejected_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      rejected_at TIMESTAMPTZ,
      rejection_reason TEXT,
      created_service_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE service_order_suggestions
    ADD COLUMN IF NOT EXISTS ignored_until TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE service_order_suggestions
    ADD COLUMN IF NOT EXISTS rejection_silence_until TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE service_order_suggestions
    ADD COLUMN IF NOT EXISTS last_rejected_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE service_order_suggestions
    ADD COLUMN IF NOT EXISTS observation_status TEXT NOT NULL DEFAULT 'none';
  `);

  await query(`
    ALTER TABLE service_order_suggestions
    ADD COLUMN IF NOT EXISTS observation_result TEXT;
  `);

  await query(`
    ALTER TABLE service_order_suggestions
    ADD COLUMN IF NOT EXISTS last_validation_id TEXT;
  `);

  await query(`
    ALTER TABLE service_order_suggestions
    ADD COLUMN IF NOT EXISTS last_observation_at TIMESTAMPTZ;
  `);

  await query(`
    UPDATE service_order_suggestions
    SET status = 'pending',
        observation_status = CASE
          WHEN status = 'observed_persistent' THEN 'observed_persistent'
          WHEN status = 'insufficient_data' THEN 'insufficient_data'
          WHEN status = 'validation_cancelled' THEN 'validation_cancelled'
          ELSE observation_status
        END,
        updated_at = NOW()
    WHERE status IN ('observed_persistent', 'insufficient_data', 'validation_cancelled');
  `);

  await query(`
    UPDATE service_order_suggestions
    SET status = CASE
          WHEN created_service_order_id IS NOT NULL THEN 'accepted'
          ELSE 'resolved'
        END,
        observation_status = CASE
          WHEN observation_status IS NULL OR observation_status = 'none' THEN 'observed_resolved'
          ELSE observation_status
        END,
        updated_at = NOW()
    WHERE status IN ('observed_resolved', 'validated');
  `);
}

export async function ensureServiceOrdersSchema() {
  await ensureServiceOrders();
  await ensureAppSettings();
  await ensureServiceOrderSettings();
  await ensureServiceOrderStatuses();
  await ensureServiceOrderHistory();
  await ensureServiceOrderItems();
  await ensureServiceOrderSuggestions();
}
