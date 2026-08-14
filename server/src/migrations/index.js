import { withTransaction } from "../database.js";
import { resolveDatabaseConfig } from "../config/environment.js";
import { migration001RuntimeFoundation } from "./001-runtime-foundation.js";
import { migration002UserPreferences } from "./002-user-preferences.js";
import { migration003WindowsAgentFoundation } from "./003-windows-agent-foundation.js";
import { migration004ExternalIntegrations } from "./004-external-integrations.js";
import { migration005CloudProductActivation } from "./005-cloud-product-activation.js";
import { migration006RemoveDemoInventory } from "./006-remove-demo-inventory.js";
import { migration007ProductKeyMonitoring } from "./007-product-key-monitoring.js";
import { migration008AgentScriptExecution } from "./008-agent-script-execution.js";
import { migration009AgentScriptAutomationLink } from "./009-agent-script-automation-link.js";
import { migration010AgentInventoryDetails } from "./010-agent-inventory-details.js";
import { migration011AssetMaintenanceLifecycle } from "./011-asset-maintenance-lifecycle.js";
import { migration012RemoteAssistanceLab } from "./012-remote-assistance-lab.js";
import { migration013RemoteAssistanceAuditIntegrity } from "./013-remote-assistance-audit-integrity.js";
import { migration014EnableRowLevelSecurity } from "./014-enable-row-level-security.js";

export const migrations = [
  migration001RuntimeFoundation,
  migration002UserPreferences,
  migration003WindowsAgentFoundation,
  migration004ExternalIntegrations,
  migration005CloudProductActivation,
  migration006RemoveDemoInventory,
  migration007ProductKeyMonitoring,
  migration008AgentScriptExecution,
  migration009AgentScriptAutomationLink,
  migration010AgentInventoryDetails,
  migration011AssetMaintenanceLifecycle,
  migration012RemoteAssistanceLab,
  migration013RemoteAssistanceAuditIntegrity,
  migration014EnableRowLevelSecurity
];

export async function runMigrations() {
  await withTransaction(async (db) => {
    if (resolveDatabaseConfig().mode === "postgres") {
      await db("SELECT pg_advisory_xact_lock($1)", [813_724_601]);
    }

    await db(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const migration of migrations) {
      const applied = await db(
        "SELECT id FROM schema_migrations WHERE id = $1",
        [migration.id]
      );
      if (applied.rowCount) continue;

      await migration.up(db);
      await db(
        "INSERT INTO schema_migrations (id) VALUES ($1)",
        [migration.id]
      );
    }
  });
}
