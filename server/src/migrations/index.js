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
import { migration015AgentScriptJobContentIntegrity } from "./015-agent-script-job-content-integrity.js";
import { migration016MaintenanceScriptContentAttribution } from "./016-maintenance-script-content-attribution.js";
import { migration017RemoteAssistanceEventHashChain } from "./017-remote-assistance-event-hash-chain.js";
import { migration018NetworkTopologyMap } from "./018-network-topology-map.js";
import { migration019RemoteAssistanceEventsAssetIndex } from "./019-remote-assistance-events-asset-index.js";
import { migration020ServiceOrderSla } from "./020-service-order-sla.js";
import { migration021ServiceOrderReopen } from "./021-service-order-reopen.js";
import { migration022ServiceOrderChecklists } from "./022-service-order-checklists.js";
import { migration023ServiceOrderAttachments } from "./023-service-order-attachments.js";
import { migration024ServiceOrderFeedback } from "./024-service-order-feedback.js";
import { migration025AssetMetricHistory } from "./025-asset-metric-history.js";
import { migration026NetworkTopologyClusterNodes } from "./026-network-topology-cluster-nodes.js";
import { migration027CalendarEvents } from "./027-calendar-events.js";
import { migration028PartsInventory } from "./028-parts-inventory.js";

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
  migration014EnableRowLevelSecurity,
  migration015AgentScriptJobContentIntegrity,
  migration016MaintenanceScriptContentAttribution,
  migration017RemoteAssistanceEventHashChain,
  migration018NetworkTopologyMap,
  migration019RemoteAssistanceEventsAssetIndex,
  migration020ServiceOrderSla,
  migration021ServiceOrderReopen,
  migration022ServiceOrderChecklists,
  migration023ServiceOrderAttachments,
  migration024ServiceOrderFeedback,
  migration025AssetMetricHistory,
  migration026NetworkTopologyClusterNodes,
  migration027CalendarEvents,
  migration028PartsInventory
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
