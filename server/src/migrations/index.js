import { query, withTransaction } from "../database.js";
import { resolveDatabaseConfig } from "../config/environment.js";
import { LEGACY_SCHEMA_MARKER, ensureMigrationsTable } from "../schema/legacyBootstrap.js";
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
import { migration025ReportExports } from "./025-report-exports.js";
import { migration025AssetMetricHistory } from "./025-asset-metric-history.js";
import { migration026NetworkTopologyClusterNodes } from "./026-network-topology-cluster-nodes.js";
import { migration027CalendarEvents } from "./027-calendar-events.js";
import { migration028PartsInventory } from "./028-parts-inventory.js";
import { migration029FloorPlanInfrastructure } from "./029-floor-plan-infrastructure.js";
import { migration030OperationalRefinements } from "./030-operational-refinements.js";
import { migration031InventoryFamiliesRemoveReports } from "./031-inventory-families-remove-reports.js";
import { migration032PhysicalHardwareFilter } from "./032-physical-hardware-filter.js";
import { migration033PhysicalComponentRefinement } from "./033-physical-component-refinement.js";
import { migration034RustdeskTransport } from "./034-rustdesk-transport.js";
import { migration035IdentityHardening } from "./035-identity-hardening.js";

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
  migration025ReportExports,
  migration025AssetMetricHistory,
  migration026NetworkTopologyClusterNodes,
  migration027CalendarEvents,
  migration028PartsInventory,
  migration029FloorPlanInfrastructure,
  migration030OperationalRefinements,
  migration031InventoryFamiliesRemoveReports,
  migration032PhysicalHardwareFilter,
  migration033PhysicalComponentRefinement,
  migration034RustdeskTransport,
  migration035IdentityHardening
];

/**
 * Situacao das migracoes sem alterar nada: usada por `db:status`, pelo modo
 * MIGRATIONS_MODE=check e pelo /health/ready.
 */
export async function getMigrationStatus() {
  const applied = new Map();
  try {
    const rows = await query("SELECT id, applied_at FROM schema_migrations");
    for (const row of rows.rows) applied.set(row.id, row.applied_at);
  } catch (error) {
    // Banco virgem: a tabela ainda nao existe (42P01 no PostgreSQL; mensagem equivalente no pg-mem).
    if (error.code !== "42P01" && !/does not exist|not exist/i.test(error.message || "")) throw error;
  }
  return {
    legacySchemaApplied: applied.has(LEGACY_SCHEMA_MARKER),
    migrations: migrations.map((migration) => ({
      id: migration.id,
      applied: applied.has(migration.id),
      appliedAt: applied.get(migration.id) || null
    })),
    pending: migrations.filter((migration) => !applied.has(migration.id)).map((migration) => migration.id)
  };
}

export async function assertSchemaUpToDate() {
  const status = await getMigrationStatus();
  if (!status.legacySchemaApplied || status.pending.length) {
    const missing = [!status.legacySchemaApplied && LEGACY_SCHEMA_MARKER, ...status.pending].filter(Boolean);
    throw new Error(
      `O esquema do banco esta desatualizado (pendentes: ${missing.join(", ")}). ` +
        "Rode `npm run db:migrate --workspace server` antes de subir esta versao (MIGRATIONS_MODE=check)."
    );
  }
  return status;
}

export async function runMigrations() {
  await withTransaction(async (db) => {
    if (resolveDatabaseConfig().mode === "postgres") {
      await db("SELECT pg_advisory_xact_lock($1)", [813_724_601]);
    }

    await ensureMigrationsTable(db);

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
