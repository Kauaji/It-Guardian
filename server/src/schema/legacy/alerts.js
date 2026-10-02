import { query } from "../../database.js";

async function ensureAlertAcknowledgements() {
  await query(`
    CREATE TABLE IF NOT EXISTS alert_acknowledgements (
      alert_id TEXT PRIMARY KEY,
      acknowledged_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      note TEXT,
      acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureAlertRules() {
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
}

async function ensureAlerts() {
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
      source TEXT NOT NULL DEFAULT 'system',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function ensureAlertComments() {
  await query(`
    CREATE TABLE IF NOT EXISTS alert_comments (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function ensureAlertsSchema() {
  await ensureAlertAcknowledgements();
  await ensureAlertRules();
  await ensureAlerts();
  await ensureAlertComments();
}
