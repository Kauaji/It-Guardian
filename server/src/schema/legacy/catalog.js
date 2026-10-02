import { query } from "../../database.js";
import { queryIgnoringDuplicateConstraint } from "./helpers.js";

async function ensureClients() {
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
}

async function ensureProducts() {
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
}

async function ensureServiceCatalog() {
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
}

async function ensureTechnicians() {
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
}

async function ensureProblemTypes() {
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
}

async function ensurePriorityRules() {
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
}

export async function ensureCatalogSchema() {
  await ensureClients();
  await ensureProducts();
  await ensureServiceCatalog();
  await ensureTechnicians();
  await ensureProblemTypes();
  await ensurePriorityRules();
}
