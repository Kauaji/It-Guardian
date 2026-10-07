import { query } from "../../database.js";
import { queryIgnoringDuplicateConstraint } from "./helpers.js";

async function ensureServiceOrderSuggestions() {
  await queryIgnoringDuplicateConstraint(`
    ALTER TABLE service_order_suggestions
    ADD CONSTRAINT service_order_suggestions_alert_id_key UNIQUE (alert_id);
  `);
}

async function ensureAlertRules() {
  await query(`
    ALTER TABLE alert_rules
    ADD COLUMN IF NOT EXISTS suggested_priority TEXT;
  `);
}

export async function ensureLateAlterationsSchema() {
  await ensureServiceOrderSuggestions();
  await ensureAlertRules();
}
