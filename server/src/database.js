import { resolveDatabaseConfig } from "./config/environment.js";

let poolPromise;

async function createPool() {
  const config = resolveDatabaseConfig();

  if (config.mode === "memory") {
    const { newDb } = await import("pg-mem");
    const db = newDb({ autoCreateForeignKeyIndices: true });
    const { Pool } = db.adapters.createPg();
    return new Pool();
  }

  const { Pool } = await import("pg");

  return new Pool({
    connectionString: config.connectionString,
    ssl: config.ssl
  });
}

export function getPool() {
  if (!poolPromise) {
    poolPromise = createPool();
  }

  return poolPromise;
}

export async function query(text, params = []) {
  const pool = await getPool();
  return pool.query(text, params);
}

export async function withTransaction(operation) {
  const pool = await getPool();
  const client = await pool.connect();
  const txQuery = (text, params = []) => client.query(text, params);

  try {
    await client.query("BEGIN");
    const result = await operation(txQuery);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function queryIgnoringDuplicateConstraint(text, params = []) {
  try {
    return await query(text, params);
  } catch (error) {
    if (error.code === "42710" || /already exists/i.test(error.message || "")) {
      return null;
    }

    throw error;
  }
}

async function removeDuplicatePreventiveAutomationOverrides() {
  const result = await query(`
    SELECT id, plan_id, target_key, created_at, updated_at
    FROM preventive_automation_overrides
    WHERE target_key IS NOT NULL
    ORDER BY plan_id ASC, target_key ASC, updated_at DESC, created_at DESC, id DESC
  `);
  const seen = new Set();
  const duplicateIds = [];

  for (const row of result.rows) {
    const key = `${row.plan_id}:${row.target_key}`;
    if (seen.has(key)) {
      duplicateIds.push(row.id);
    } else {
      seen.add(key);
    }
  }

  for (const id of duplicateIds) {
    await query("DELETE FROM preventive_automation_overrides WHERE id = $1", [id]);
  }
}

export async function initializeDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator'
        CHECK (role IN ('admin', 'operator', 'viewer')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sectors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS sector_id TEXT REFERENCES sectors(id) ON DELETE SET NULL;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS job_title TEXT;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  await query(`
    UPDATE users
    SET is_admin = TRUE
    WHERE role = 'admin';
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alert_acknowledgements (
      alert_id TEXT PRIMARY KEY,
      acknowledged_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      note TEXT,
      acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      metric TEXT NOT NULL,
      threshold NUMERIC(12, 2),
      duration_minutes INTEGER NOT NULL DEFAULT 5,
      recurrence_count INTEGER NOT NULL DEFAULT 3,
      recurrence_window TEXT NOT NULL DEFAULT 'same_day',
      suggested_priority TEXT,
      creates_suggestion BOOLEAN NOT NULL DEFAULT TRUE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      asset_id TEXT,
      host_name TEXT,
      type TEXT NOT NULL,
      metric TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      severity TEXT NOT NULL DEFAULT 'warning',
      value NUMERIC(12, 2),
      threshold NUMERIC(12, 2),
      status TEXT NOT NULL DEFAULT 'active',
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      occurrences_count INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'mock',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alert_comments (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS inventory_segments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#1f7a61',
      group_id TEXT,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS segment_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#8b9bb0',
      collapsed BOOLEAN NOT NULL DEFAULT FALSE,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE inventory_segments
    ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#1f7a61';
  `);

  await query(`
    ALTER TABLE inventory_segments
    ADD COLUMN IF NOT EXISTS group_id TEXT;
  `);

  await queryIgnoringDuplicateConstraint(`
    ALTER TABLE inventory_segments
    ADD CONSTRAINT inventory_segments_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES segment_groups(id) ON DELETE SET NULL;
  `);

  await query(`
    ALTER TABLE inventory_segments
    DROP CONSTRAINT IF EXISTS inventory_segments_name_key;
  `);

  await query(`
    DROP INDEX IF EXISTS inventory_segments_name_key;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS device_segments (
      device_id TEXT PRIMARY KEY,
      segment_id TEXT NOT NULL REFERENCES inventory_segments(id) ON DELETE RESTRICT,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS manual_network_assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      asset_tag TEXT NOT NULL,
      ip TEXT NOT NULL,
      mac_address TEXT,
      hostname TEXT,
      identification_mode TEXT NOT NULL DEFAULT 'fixed_ip',
      location TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'offline'
        CHECK (status IN ('online', 'offline', 'problem')),
      last_ping_at TIMESTAMPTZ,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS device_metadata (
      device_id TEXT PRIMARY KEY,
      asset_type TEXT NOT NULL,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      removed_at TIMESTAMPTZ,
      removed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS removed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS is_backup BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS backup_status TEXT NOT NULL DEFAULT 'available';
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS backup_order_id TEXT;
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS backup_original_segment_id TEXT;
  `);

  await query(`
    ALTER TABLE device_metadata
    ADD COLUMN IF NOT EXISTS backup_original_segment_name TEXT;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS asset_history (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      user_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

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

  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

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

  await query(`
    CREATE TABLE IF NOT EXISTS maintenance_scripts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      estimated_summary TEXT,
      category TEXT,
      risk_level TEXT NOT NULL DEFAULT 'medium',
      suggested_risk_level TEXT NOT NULL DEFAULT 'medium',
      requires_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      alert_type TEXT,
      problem_type TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE maintenance_scripts
    ADD COLUMN IF NOT EXISTS alert_type TEXT;
  `);

  await query(`
    ALTER TABLE maintenance_scripts
    ADD COLUMN IF NOT EXISTS problem_type TEXT;
  `);

  await query(`
    ALTER TABLE maintenance_scripts
    ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await query(`
    ALTER TABLE maintenance_scripts
    ADD COLUMN IF NOT EXISTS supported_variables JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await query(`
    ALTER TABLE maintenance_scripts
    ADD COLUMN IF NOT EXISTS related_alert_types JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await query(`
    ALTER TABLE maintenance_scripts
    ADD COLUMN IF NOT EXISTS related_problem_types JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await query(`
    ALTER TABLE maintenance_scripts
    ADD COLUMN IF NOT EXISTS recommended_for_categories JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await query(`
    ALTER TABLE maintenance_scripts
    ADD COLUMN IF NOT EXISTS requires_logged_user BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    ALTER TABLE maintenance_scripts
    ADD COLUMN IF NOT EXISTS requires_admin BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    ALTER TABLE maintenance_scripts
    ADD COLUMN IF NOT EXISTS safe_preview TEXT;
  `);

  await query(`
    ALTER TABLE maintenance_scripts
    ADD COLUMN IF NOT EXISTS variable_validation_status TEXT NOT NULL DEFAULT 'valid';
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS script_execution_logs (
      id TEXT PRIMARY KEY,
      script_id TEXT NOT NULL REFERENCES maintenance_scripts(id) ON DELETE CASCADE,
      asset_id TEXT,
      service_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
      alert_id TEXT REFERENCES alerts(id) ON DELETE SET NULL,
      mode TEXT NOT NULL DEFAULT 'simulated',
      status TEXT NOT NULL DEFAULT 'registered',
      executed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS suggestion_id TEXT REFERENCES service_order_suggestions(id) ON DELETE SET NULL;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS preventive_plan_id TEXT;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS raw_log TEXT;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS parsed_summary TEXT;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS error_detected BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS error_type TEXT;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS error_code TEXT;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS error_category TEXT;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS error_severity TEXT;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS probable_cause TEXT;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS suggested_solution TEXT;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS requires_admin BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS requires_logged_user BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS attention_required BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS acknowledged_by TEXT REFERENCES users(id) ON DELETE SET NULL;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS corrective_action_status TEXT;
  `);

  await query(`
    ALTER TABLE script_execution_logs
    ADD COLUMN IF NOT EXISTS corrective_action_notes TEXT;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS script_validation_runs (
      id TEXT PRIMARY KEY,
      suggestion_id TEXT REFERENCES service_order_suggestions(id) ON DELETE CASCADE,
      alert_id TEXT REFERENCES alerts(id) ON DELETE SET NULL,
      asset_id TEXT,
      script_id TEXT REFERENCES maintenance_scripts(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'waiting_agent',
      started_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      validation_window_minutes INTEGER NOT NULL DEFAULT 30,
      validation_due_at TIMESTAMPTZ NOT NULL,
      finished_at TIMESTAMPTZ,
      result_summary TEXT,
      log_id TEXT REFERENCES script_execution_logs(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE script_validation_runs
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
  `);

  await query(`
    ALTER TABLE script_validation_runs
    ADD COLUMN IF NOT EXISTS observation_slot TEXT;
  `);

  await query(`
    ALTER TABLE script_validation_runs
    ADD COLUMN IF NOT EXISTS active_key TEXT;
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_script_validation_active_key
    ON script_validation_runs (active_key);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS preventive_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'prepared',
      source TEXT NOT NULL DEFAULT 'manual',
      origin_alert_id TEXT REFERENCES alerts(id) ON DELETE SET NULL,
      origin_suggestion_id TEXT REFERENCES service_order_suggestions(id) ON DELETE SET NULL,
      notes TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      prepared_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS preventive_plan_scripts (
      id TEXT PRIMARY KEY,
      preventive_plan_id TEXT NOT NULL REFERENCES preventive_plans(id) ON DELETE CASCADE,
      script_id TEXT NOT NULL REFERENCES maintenance_scripts(id) ON DELETE RESTRICT,
      order_index INTEGER NOT NULL DEFAULT 0
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS preventive_plan_assets (
      id TEXT PRIMARY KEY,
      preventive_plan_id TEXT NOT NULL REFERENCES preventive_plans(id) ON DELETE CASCADE,
      asset_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'prepared',
      log TEXT,
      prepared_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );
  `);

  await query(`
    ALTER TABLE preventive_plans
    ADD COLUMN IF NOT EXISTS service_order_id TEXT;
  `);

  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS preventive_plan_id TEXT;
  `);

  await query(`
    UPDATE preventive_plans
    SET service_order_id = NULL
    WHERE service_order_id IS NOT NULL
      AND service_order_id NOT IN (SELECT id FROM service_orders);
  `);

  await query(`
    UPDATE service_orders
    SET preventive_plan_id = NULL
    WHERE preventive_plan_id IS NOT NULL
      AND preventive_plan_id NOT IN (SELECT id FROM preventive_plans);
  `);

  await queryIgnoringDuplicateConstraint(`
    ALTER TABLE preventive_plans
    ADD CONSTRAINT preventive_plans_service_order_id_fkey
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE SET NULL;
  `);

  await queryIgnoringDuplicateConstraint(`
    ALTER TABLE service_orders
    ADD CONSTRAINT service_orders_preventive_plan_id_fkey
    FOREIGN KEY (preventive_plan_id) REFERENCES preventive_plans(id) ON DELETE SET NULL;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS preventive_automation_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      recurrence_type TEXT NOT NULL DEFAULT 'monthly',
      recurrence_interval INTEGER NOT NULL DEFAULT 30,
      preferred_time TEXT NOT NULL DEFAULT '08:00',
      timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
      scope_type TEXT NOT NULL DEFAULT 'all',
      scope_id TEXT,
      default_script_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      notes TEXT,
      indicator_color TEXT NOT NULL DEFAULT '#1f7a61',
      last_scheduled_at TIMESTAMPTZ,
      last_prepared_at TIMESTAMPTZ,
      last_run_at TIMESTAMPTZ,
      next_run_at TIMESTAMPTZ,
      schedule_anchor_at TIMESTAMPTZ,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE preventive_automation_plans
    ADD COLUMN IF NOT EXISTS last_scheduled_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE preventive_automation_plans
    ADD COLUMN IF NOT EXISTS last_prepared_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE preventive_automation_plans
    ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE preventive_automation_plans
    ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE preventive_automation_plans
    ADD COLUMN IF NOT EXISTS schedule_anchor_at TIMESTAMPTZ;
  `);
  await query(`
    ALTER TABLE preventive_automation_plans
    ADD COLUMN IF NOT EXISTS indicator_color TEXT NOT NULL DEFAULT '#1f7a61';
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS preventive_automation_overrides (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES preventive_automation_plans(id) ON DELETE CASCADE,
      asset_id TEXT,
      segment_id TEXT,
      target_key TEXT,
      recurrence_type TEXT NOT NULL DEFAULT 'monthly',
      recurrence_interval INTEGER NOT NULL DEFAULT 30,
      preferred_time TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE preventive_automation_overrides
    ADD COLUMN IF NOT EXISTS target_key TEXT;
  `);

  await query(`
    UPDATE preventive_automation_overrides
    SET target_key = CASE
      WHEN asset_id IS NOT NULL AND asset_id <> '' THEN 'asset:' || asset_id
      WHEN segment_id IS NOT NULL AND segment_id <> '' THEN 'segment:' || segment_id
      ELSE NULL
    END
    WHERE target_key IS NULL;
  `);

  await removeDuplicatePreventiveAutomationOverrides();

  await query(`
    CREATE TABLE IF NOT EXISTS preventive_automation_runs (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES preventive_automation_plans(id) ON DELETE CASCADE,
      asset_id TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      scheduled_for TIMESTAMPTZ NOT NULL,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      result TEXT,
      log_summary TEXT,
      error_detected BOOLEAN NOT NULL DEFAULT FALSE,
      idempotency_key TEXT,
      schedule_slot TIMESTAMPTZ,
      recurrence_source TEXT,
      recurrence_interval INTEGER,
      preferred_time TEXT,
      next_run_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE preventive_automation_runs
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
  `);

  await query(`
    ALTER TABLE preventive_automation_runs
    ADD COLUMN IF NOT EXISTS schedule_slot TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE preventive_automation_runs
    ADD COLUMN IF NOT EXISTS recurrence_source TEXT;
  `);

  await query(`
    ALTER TABLE preventive_automation_runs
    ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER;
  `);

  await query(`
    ALTER TABLE preventive_automation_runs
    ADD COLUMN IF NOT EXISTS preferred_time TEXT;
  `);

  await query(`
    ALTER TABLE preventive_automation_runs
    ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE preventive_automation_runs
    ADD COLUMN IF NOT EXISTS trigger_type TEXT NOT NULL DEFAULT 'scheduled';
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS preventive_automation_asset_schedules (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES preventive_automation_plans(id) ON DELETE CASCADE,
      asset_id TEXT NOT NULL,
      recurrence_source TEXT NOT NULL DEFAULT 'plan',
      recurrence_type TEXT NOT NULL DEFAULT 'monthly',
      recurrence_interval INTEGER NOT NULL DEFAULT 30,
      preferred_time TEXT NOT NULL DEFAULT '08:00',
      timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
      last_scheduled_at TIMESTAMPTZ,
      last_prepared_at TIMESTAMPTZ,
      next_run_at TIMESTAMPTZ,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (plan_id, asset_id)
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_asset_schedules_due
    ON preventive_automation_asset_schedules (active, next_run_at);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_asset_schedules_plan
    ON preventive_automation_asset_schedules (plan_id);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_order_suggestions_alert
    ON service_order_suggestions (alert_id);
  `);

  await queryIgnoringDuplicateConstraint(`
    ALTER TABLE service_order_suggestions
    ADD CONSTRAINT service_order_suggestions_alert_id_key UNIQUE (alert_id);
  `);

  await query(`
    ALTER TABLE alert_rules
    ADD COLUMN IF NOT EXISTS suggested_priority TEXT;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      trade_name TEXT NOT NULL,
      legal_name TEXT,
      document TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      contact_name TEXT,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      brand TEXT,
      model TEXT,
      internal_code TEXT,
      asset_tag TEXT,
      quantity NUMERIC NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'un',
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS asset_tag TEXT;
  `);

  await query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS service_catalog (
      id TEXT PRIMARY KEY,
      code TEXT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      default_priority TEXT
        CHECK (default_priority IS NULL OR default_priority IN ('low', 'medium', 'high', 'critical')),
      default_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE service_catalog
    ADD COLUMN IF NOT EXISTS code TEXT;
  `);

  await query(`
    ALTER TABLE service_catalog
    ADD COLUMN IF NOT EXISTS description TEXT;
  `);

  await query(`
    ALTER TABLE service_catalog
    ADD COLUMN IF NOT EXISTS default_priority TEXT
      CHECK (default_priority IS NULL OR default_priority IN ('low', 'medium', 'high', 'critical'));
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_catalog_code_unique
    ON service_catalog (lower(code));
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS technicians (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT,
      specialty TEXT,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE technicians
    ADD COLUMN IF NOT EXISTS allowed_client_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS problem_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      default_priority TEXT
        CHECK (default_priority IS NULL OR default_priority IN ('low', 'medium', 'high', 'critical')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS priority_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rule_type TEXT NOT NULL DEFAULT 'problem_type'
        CHECK (rule_type IN ('client', 'sector', 'problem_type', 'service', 'category', 'open_time', 'equipment_category')),
      target_value TEXT,
      priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      threshold_hours NUMERIC,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE priority_rules
    DROP CONSTRAINT IF EXISTS priority_rules_rule_type_check;
  `);

  await queryIgnoringDuplicateConstraint(`
    ALTER TABLE priority_rules
    ADD CONSTRAINT priority_rules_rule_type_check
      CHECK (rule_type IN ('client', 'sector', 'problem_type', 'service', 'category', 'open_time', 'equipment_category'));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs (created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alert_acknowledgements_acknowledged_at
    ON alert_acknowledgements (acknowledged_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alerts_status
    ON alerts (status, last_seen_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alert_rules_type
    ON alert_rules (type, enabled);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alert_comments_alert
    ON alert_comments (alert_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_order_suggestions_status
    ON service_order_suggestions (status, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_maintenance_scripts_active
    ON maintenance_scripts (active, updated_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_script_execution_logs_script
    ON script_execution_logs (script_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_script_execution_logs_asset
    ON script_execution_logs (asset_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_script_execution_logs_suggestion
    ON script_execution_logs (suggestion_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_script_execution_logs_attention
    ON script_execution_logs (attention_required, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_script_validation_runs_suggestion
    ON script_validation_runs (suggestion_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_script_validation_runs_due
    ON script_validation_runs (status, validation_due_at);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_order_suggestions_ignored_until
    ON service_order_suggestions (ignored_until);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_plans_created_at
    ON preventive_plans (created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_plan_assets_asset
    ON preventive_plan_assets (asset_id);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_preventive_plans_service_order_unique
    ON preventive_plans (service_order_id);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_preventive_plan_unique
    ON service_orders (preventive_plan_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_plans_active
    ON preventive_automation_plans (active, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_plans_due
    ON preventive_automation_plans (active, next_run_at);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_overrides_plan
    ON preventive_automation_overrides (plan_id);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_preventive_automation_overrides_target
    ON preventive_automation_overrides (plan_id, target_key);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_runs_plan
    ON preventive_automation_runs (plan_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_runs_asset
    ON preventive_automation_runs (asset_id, scheduled_for DESC);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_preventive_automation_run_unique
    ON preventive_automation_runs (plan_id, asset_id, scheduled_for);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_device_segments_segment_id
    ON device_segments (segment_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_segments_group_id
    ON inventory_segments (group_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_manual_network_assets_ip
    ON manual_network_assets (ip);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_asset_history_asset_id
    ON asset_history (asset_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_orders_status
    ON service_orders (status, created_at DESC);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_number_unique
    ON service_orders (number);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_order_statuses_order
    ON service_order_statuses (sort_order, created_at);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_orders_asset_id
    ON service_orders (asset_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_orders_sector_id
    ON service_orders (sector_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_orders_service_id
    ON service_orders (service_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_order_history_order_id
    ON service_order_history (service_order_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_order_items_order_id
    ON service_order_items (service_order_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_clients_trade_name
    ON clients (lower(trade_name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_products_name
    ON products (lower(name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_products_internal_code
    ON products (lower(internal_code));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_catalog_name
    ON service_catalog (lower(name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_catalog_code
    ON service_catalog (lower(code));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_technicians_name
    ON technicians (lower(name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_problem_types_name
    ON problem_types (lower(name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_priority_rules_type
    ON priority_rules (rule_type, active);
  `);
}
