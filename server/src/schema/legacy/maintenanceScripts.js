import { query } from "../../database.js";

async function ensureMaintenanceScripts() {
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
}

async function ensureScriptExecutionLogs() {
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
}

async function ensureScriptValidationRuns() {
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
}

export async function ensureMaintenanceScriptsSchema() {
  await ensureMaintenanceScripts();
  await ensureScriptExecutionLogs();
  await ensureScriptValidationRuns();
}
