import {
  correlateNormalizedAsset,
  normalizeOcsAsset,
  normalizeZabbixHost,
  normalizeZabbixProblem
} from "../domain/integrationNormalization.js";
import { ocsInventoryService } from "../integrations/ocs/OcsInventoryService.js";
import { zabbixService } from "../integrations/zabbix/ZabbixService.js";
import {
  getIntegrationState,
  listIntegrationAlerts,
  listIntegrationAssets,
  listOpenIntegrationConflicts,
  recordIntegrationFailure,
  saveIntegrationSync
} from "../repositories/integrationRepository.js";

const INTEGRATIONS = {
  ocs: ocsInventoryService,
  zabbix: zabbixService
};

function storeRawData() {
  return String(process.env.INTEGRATION_STORE_RAW_DATA || "").toLowerCase() === "true";
}

function integrationFor(source) {
  const integration = INTEGRATIONS[source];
  if (integration) return integration;

  const error = new Error("Integracao desconhecida.");
  error.statusCode = 404;
  error.expose = true;
  throw error;
}

function safeFailureMessage(source) {
  return `Nao foi possivel sincronizar a integracao ${source.toUpperCase()}. Verifique a configuracao e tente novamente.`;
}

function correlationFor(asset, existingAssets) {
  const result = correlateNormalizedAsset(asset, existingAssets);
  if (result.conflict) {
    return {
      correlation: {
        conflict: true,
        strategy: null,
        matchedIntegrationAssetId: null,
        evidence: result.evidence
      },
      conflict: {
        source: asset.source,
        externalId: asset.externalId,
        reason: "Identificadores apontam para ativos diferentes. Revisao manual necessaria.",
        candidateIds: result.candidates.map((candidate) => candidate.id),
        evidence: result.evidence
      }
    };
  }

  return {
    correlation: {
      conflict: false,
      strategy: result.strategy,
      matchedIntegrationAssetId: result.match?.id || null,
      evidence: result.evidence
    },
    conflict: null
  };
}

async function correlateAssets(assets) {
  const existingAssets = await listIntegrationAssets();
  const conflicts = [];
  const correlatedAssets = assets.map((asset) => {
    const result = correlationFor(asset, existingAssets);
    if (result.conflict) conflicts.push(result.conflict);
    return { ...asset, correlation: result.correlation };
  });
  return { assets: correlatedAssets, conflicts };
}

async function persistSync({ source, assets, alerts = [] }) {
  const integration = integrationFor(source);
  const configuration = integration.getConfiguration();
  const correlated = await correlateAssets(assets);
  return saveIntegrationSync({
    source,
    enabled: configuration.enabled,
    mode: configuration.mode,
    baseUrl: configuration.baseUrl,
    assets: correlated.assets,
    alerts,
    conflicts: correlated.conflicts,
    metadata: {
      configured: configuration.configured,
      rawDataStored: storeRawData()
    }
  });
}

async function recordFailure(source) {
  const configuration = integrationFor(source).getConfiguration();
  await recordIntegrationFailure({
    source,
    enabled: configuration.enabled,
    mode: configuration.mode,
    baseUrl: configuration.baseUrl,
    message: safeFailureMessage(source)
  });
}

export async function getIntegrationStatus(source) {
  const integration = integrationFor(source);
  const [state, conflicts] = await Promise.all([
    getIntegrationState(source),
    listOpenIntegrationConflicts(source)
  ]);
  return {
    configuration: integration.getConfiguration(),
    state,
    conflicts
  };
}

export async function testIntegrationConnection(source) {
  return integrationFor(source).testConnection();
}

export async function getIntegrationLastSync(source) {
  integrationFor(source);
  return getIntegrationState(source);
}

export async function syncOcsInventory() {
  const configuration = ocsInventoryService.getConfiguration();
  if (!configuration.enabled || configuration.mode === "disabled") {
    return { skipped: true, reason: "disabled", configuration };
  }

  try {
    const rawAssets = await ocsInventoryService.listInventory();
    const assets = rawAssets.map((asset) =>
      normalizeOcsAsset(asset, { includeRawData: storeRawData() })
    );
    const result = await persistSync({ source: "ocs", assets });
    return { skipped: false, ...result };
  } catch (error) {
    await recordFailure("ocs");
    throw error;
  }
}

export async function syncZabbix() {
  const configuration = zabbixService.getConfiguration();
  if (!configuration.enabled || configuration.mode === "disabled") {
    return { skipped: true, reason: "disabled", configuration };
  }

  try {
    const [rawHosts, rawProblems] = await Promise.all([
      zabbixService.getHosts(),
      zabbixService.getAlerts()
    ]);
    const includeRawData = storeRawData();
    const assets = rawHosts.map((host) => normalizeZabbixHost(host, { includeRawData }));
    const alerts = rawProblems.map((problem) =>
      normalizeZabbixProblem(problem, { includeRawData })
    );
    const result = await persistSync({ source: "zabbix", assets, alerts });
    return { skipped: false, ...result };
  } catch (error) {
    await recordFailure("zabbix");
    throw error;
  }
}

export async function listZabbixProblems({ status = "active" } = {}) {
  return listIntegrationAlerts({ source: "zabbix", status: status || null });
}
