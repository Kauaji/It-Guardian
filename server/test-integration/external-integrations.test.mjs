import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "false";
process.env.JWT_SECRET = "external-integration-test-secret-with-32-characters";
process.env.NODE_ENV = "test";

const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");
const {
  getIntegrationState,
  listIntegrationAlerts,
  listIntegrationAssets,
  listOpenIntegrationConflicts,
  saveIntegrationSync
} = await import("../src/repositories/integrationRepository.js");

function asset(overrides = {}) {
  return {
    source: "ocs",
    externalId: "ocs-42",
    hostname: "srv-app-01",
    displayName: "SRV-APP-01",
    ip: "10.10.1.42",
    serialNumber: "SERIAL-42",
    assetTag: null,
    macAddress: null,
    manufacturer: "Dell",
    model: "PowerEdge",
    operatingSystem: "Ubuntu Server",
    status: "online",
    metrics: {},
    hardware: {},
    correlation: {},
    rawData: null,
    collectedAt: "2026-07-27T12:00:00.000Z",
    ...overrides
  };
}

test("snapshots externos preservam ativos, alertas, correlacao e conflitos", async (t) => {
  await initializeRuntime();
  t.after(closeDatabase);

  const result = await saveIntegrationSync({
    source: "ocs",
    enabled: true,
    mode: "real",
    baseUrl: "http://ocs.internal",
    assets: [asset()],
    conflicts: [{
      source: "ocs",
      externalId: "ocs-42",
      reason: "Revisao manual necessaria.",
      candidateIds: ["agent-42", "zabbix-42"],
      evidence: [{ strategy: "hostname", candidateIds: ["agent-42", "zabbix-42"] }]
    }]
  });
  await saveIntegrationSync({
    source: "zabbix",
    enabled: true,
    mode: "real",
    baseUrl: "http://zabbix.internal/api_jsonrpc.php",
    assets: [asset({
      source: "zabbix",
      externalId: "zabbix-42",
      correlation: {
        conflict: false,
        strategy: "hostname",
        matchedIntegrationAssetId: result.assets[0].id
      }
    })],
    alerts: [{
      source: "zabbix",
      externalId: "problem-1",
      assetExternalId: "zabbix-42",
      assetHostname: "srv-app-01",
      name: "Agente indisponivel",
      severity: "high",
      status: "active",
      occurredAt: "2026-07-27T12:05:00.000Z",
      resolvedAt: null,
      metadata: {},
      rawData: null
    }]
  });

  const assets = await listIntegrationAssets();
  const alerts = await listIntegrationAlerts({ source: "zabbix", status: "active" });
  const conflicts = await listOpenIntegrationConflicts("ocs");
  const ocsState = await getIntegrationState("ocs");
  const zabbixState = await getIntegrationState("zabbix");

  assert.equal(assets.length, 2);
  assert.equal(alerts.length, 1);
  assert.equal(conflicts.length, 1);
  assert.equal(ocsState.lastStatus, "success");
  assert.equal(ocsState.importedAssets, 1);
  assert.equal(zabbixState.importedAssets, 1);
  assert.equal(zabbixState.importedAlerts, 1);
});
