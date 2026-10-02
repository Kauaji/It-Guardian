import { query } from "../../database.js";
import { queryIgnoringDuplicateConstraint, removeDuplicatePreventiveAutomationOverrides } from "./helpers.js";

async function ensurePreventivePlans() {
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
}

async function ensurePreventivePlanScripts() {
  await query(`
    CREATE TABLE IF NOT EXISTS preventive_plan_scripts (
      id TEXT PRIMARY KEY,
      preventive_plan_id TEXT NOT NULL REFERENCES preventive_plans(id) ON DELETE CASCADE,
      script_id TEXT NOT NULL REFERENCES maintenance_scripts(id) ON DELETE RESTRICT,
      order_index INTEGER NOT NULL DEFAULT 0
    );
  `);
}

async function ensurePreventivePlanAssets() {
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
}

async function ensurePreventivePlansPart2() {
  await query(`
    ALTER TABLE preventive_plans
    ADD COLUMN IF NOT EXISTS service_order_id TEXT;
  `);
}

async function ensureServiceOrders() {
  await query(`
    ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS preventive_plan_id TEXT;
  `);
}

async function ensurePreventivePlansPart3() {
  await query(`
    UPDATE preventive_plans
    SET service_order_id = NULL
    WHERE service_order_id IS NOT NULL
      AND service_order_id NOT IN (SELECT id FROM service_orders);
  `);
}

async function ensureServiceOrdersPart2() {
  await query(`
    UPDATE service_orders
    SET preventive_plan_id = NULL
    WHERE preventive_plan_id IS NOT NULL
      AND preventive_plan_id NOT IN (SELECT id FROM preventive_plans);
  `);
}

async function ensurePreventivePlansPart4() {
  await queryIgnoringDuplicateConstraint(`
    ALTER TABLE preventive_plans
    ADD CONSTRAINT preventive_plans_service_order_id_fkey
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE SET NULL;
  `);
}

async function ensureServiceOrdersPart3() {
  await queryIgnoringDuplicateConstraint(`
    ALTER TABLE service_orders
    ADD CONSTRAINT service_orders_preventive_plan_id_fkey
    FOREIGN KEY (preventive_plan_id) REFERENCES preventive_plans(id) ON DELETE SET NULL;
  `);
}

async function ensurePreventiveAutomationPlans() {
  await query(`
    CREATE TABLE IF NOT EXISTS preventive_automation_plans (
      id TEXT PRIMARY KEY,
      preventive_plan_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      recurrence_type TEXT NOT NULL DEFAULT 'monthly',
      recurrence_interval INTEGER NOT NULL DEFAULT 30,
      preferred_time TEXT NOT NULL DEFAULT '08:00',
      timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
      scope_type TEXT NOT NULL DEFAULT 'all',
      scope_id TEXT,
      asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      excluded_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      default_script_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      notes TEXT,
      indicator_color TEXT NOT NULL DEFAULT '#1f7a61',
      last_scheduled_at TIMESTAMPTZ,
      last_prepared_at TIMESTAMPTZ,
      last_run_at TIMESTAMPTZ,
      next_run_at TIMESTAMPTZ,
      schedule_anchor_at TIMESTAMPTZ,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE preventive_automation_plans
    ADD COLUMN IF NOT EXISTS preventive_plan_id TEXT;
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
    ADD COLUMN IF NOT EXISTS asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await query(`
    ALTER TABLE preventive_automation_plans
    ADD COLUMN IF NOT EXISTS excluded_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await query(`
    ALTER TABLE preventive_automation_plans
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE preventive_automation_plans
    ADD COLUMN IF NOT EXISTS indicator_color TEXT NOT NULL DEFAULT '#1f7a61';
  `);

  await query(`
    UPDATE preventive_automation_plans
    SET preventive_plan_id = NULL
    WHERE preventive_plan_id IS NOT NULL
      AND preventive_plan_id NOT IN (SELECT id FROM preventive_plans);
  `);

  await queryIgnoringDuplicateConstraint(`
    ALTER TABLE preventive_automation_plans
    ADD CONSTRAINT preventive_automation_plans_preventive_plan_id_fkey
    FOREIGN KEY (preventive_plan_id) REFERENCES preventive_plans(id) ON DELETE CASCADE;
  `);
}

async function ensurePreventiveAutomationOverrides() {
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
}

async function ensurePreventiveAutomationRuns() {
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
}

async function ensurePreventiveAutomationAssetSchedules() {
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
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_asset_schedules_active_next
    ON preventive_automation_asset_schedules (active, next_run_at);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_asset_schedules_next_run
    ON preventive_automation_asset_schedules (next_run_at);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_asset_schedules_plan
    ON preventive_automation_asset_schedules (plan_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_asset_schedules_asset
    ON preventive_automation_asset_schedules (asset_id);
  `);
}

async function ensureServiceOrderSuggestions() {
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_order_suggestions_alert
    ON service_order_suggestions (alert_id);
  `);
}

export async function ensurePreventiveMaintenanceSchema() {
  await ensurePreventivePlans();
  await ensurePreventivePlanScripts();
  await ensurePreventivePlanAssets();
  await ensurePreventivePlansPart2();
  await ensureServiceOrders();
  await ensurePreventivePlansPart3();
  await ensureServiceOrdersPart2();
  await ensurePreventivePlansPart4();
  await ensureServiceOrdersPart3();
  await ensurePreventiveAutomationPlans();
  await ensurePreventiveAutomationOverrides();
  await ensurePreventiveAutomationRuns();
  await ensurePreventiveAutomationAssetSchedules();
  await ensureServiceOrderSuggestions();
}
