import { ensureIdentitySchema } from "./identity.js";
import { ensureAlertsSchema } from "./alerts.js";
import { ensureInventorySchema } from "./inventory.js";
import { ensureVisualMapsSchema } from "./visualMaps.js";
import { ensureFloorPlansSchema } from "./floorPlans.js";
import { ensureServiceOrdersSchema } from "./serviceOrders.js";
import { ensureMaintenanceScriptsSchema } from "./maintenanceScripts.js";
import { ensurePreventiveMaintenanceSchema } from "./preventiveMaintenance.js";
import { ensureLateAlterationsSchema } from "./lateAlterations.js";
import { ensureCatalogSchema } from "./catalog.js";
import { ensureIndexesSchema } from "./indexes.js";

/**
 * Esquema "legado": tudo que existia antes do sistema de migracoes numeradas.
 * A ORDEM importa (chaves estrangeiras e ALTERs dependem de tabelas criadas
 * antes). Este conjunto esta CONGELADO: mudancas novas de esquema entram como
 * migracao em src/migrations/ -- o teste `legacySchemaFrozen` barra edicoes.
 */
export const legacySchemaSteps = [
  ["identity", ensureIdentitySchema],
  ["alerts", ensureAlertsSchema],
  ["inventory", ensureInventorySchema],
  ["visualMaps", ensureVisualMapsSchema],
  ["floorPlans", ensureFloorPlansSchema],
  ["serviceOrders", ensureServiceOrdersSchema],
  ["maintenanceScripts", ensureMaintenanceScriptsSchema],
  ["preventiveMaintenance", ensurePreventiveMaintenanceSchema],
  ["lateAlterations", ensureLateAlterationsSchema],
  ["catalog", ensureCatalogSchema],
  ["indexes", ensureIndexesSchema]
];

export async function runLegacySchema() {
  for (const [, step] of legacySchemaSteps) {
    await step();
  }
}
