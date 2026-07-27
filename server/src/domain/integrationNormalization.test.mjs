import assert from "node:assert/strict";
import test from "node:test";
import {
  correlateNormalizedAsset,
  normalizeOcsAsset,
  normalizeZabbixHost,
  normalizeZabbixProblem,
  supportedAssetSources
} from "./integrationNormalization.js";

test("normaliza ativo OCS sem persistir o payload bruto por padrao", () => {
  const asset = normalizeOcsAsset({
    id: 42,
    NAME: "SRV-APP-01.",
    IPADDRESS: "10.10.1.42",
    SSN: " ab 123 ",
    MANUFACTURER: "Dell",
    MODEL: "PowerEdge",
    OSNAME: "Ubuntu Server",
    LASTDATE: "2026-07-27T12:00:00.000Z",
    memoryGb: "32"
  });

  assert.equal(asset.source, "ocs");
  assert.equal(asset.externalId, "42");
  assert.equal(asset.hostname, "srv-app-01");
  assert.equal(asset.ip, "10.10.1.42");
  assert.equal(asset.serialNumber, "ab 123");
  assert.equal(asset.hardware.ramGb, 32);
  assert.equal(asset.rawData, null);
});

test("normaliza host e problema Zabbix", () => {
  const host = normalizeZabbixHost({
    hostid: "10084",
    host: "WS-FIN-07",
    name: "Financeiro 07",
    status: "0",
    interfaces: [{ main: "1", ip: "10.10.7.45", available: "1" }],
    inventory: {
      serialno_a: "FIN-007",
      vendor: "Lenovo",
      model: "ThinkCentre",
      os_full: "Windows 11 Pro"
    },
    collectedAt: "2026-07-27T12:05:00.000Z"
  });
  const problem = normalizeZabbixProblem({
    eventid: "9001",
    hostid: "10084",
    hostname: "WS-FIN-07",
    name: "Agente indisponivel",
    severity: "4",
    clock: 1785153900
  });

  assert.equal(host.source, "zabbix");
  assert.equal(host.externalId, "10084");
  assert.equal(host.status, "online");
  assert.equal(host.serialNumber, "FIN-007");
  assert.equal(problem.assetExternalId, "10084");
  assert.equal(problem.assetHostname, "ws-fin-07");
  assert.equal(problem.severity, "high");
  assert.equal(problem.status, "active");
  assert.equal(problem.rawData, null);
});

test("correlaciona com seguranca por hostname e por IP", () => {
  const existing = [
    {
      id: "asset-hostname",
      source: "ocs",
      externalId: "42",
      hostname: "srv-app-01",
      ip: "10.10.1.42"
    },
    {
      id: "asset-ip",
      source: "agent",
      externalId: "agent-43",
      hostname: "srv-db-01",
      ip: "10.10.1.43"
    }
  ];

  const byHostname = correlateNormalizedAsset({
    source: "zabbix",
    externalId: "10084",
    hostname: "SRV-APP-01."
  }, existing);
  const byIp = correlateNormalizedAsset({
    source: "zabbix",
    externalId: "10085",
    hostname: "host-sem-correspondencia",
    ip: "10.10.1.43"
  }, existing);

  assert.equal(byHostname.match.id, "asset-hostname");
  assert.equal(byHostname.strategy, "hostname");
  assert.equal(byHostname.conflict, false);
  assert.equal(byIp.match.id, "asset-ip");
  assert.equal(byIp.strategy, "ip");
});

test("identificadores conflitantes nunca causam mesclagem automatica", () => {
  const result = correlateNormalizedAsset({
    source: "zabbix",
    externalId: "10084",
    hostname: "srv-app-01",
    ip: "10.10.1.99"
  }, [
    {
      id: "asset-hostname",
      source: "ocs",
      externalId: "42",
      hostname: "srv-app-01",
      ip: "10.10.1.42"
    },
    {
      id: "asset-ip",
      source: "agent",
      externalId: "agent-99",
      hostname: "outro-host",
      ip: "10.10.1.99"
    }
  ]);

  assert.equal(result.conflict, true);
  assert.equal(result.match, null);
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id).sort(),
    ["asset-hostname", "asset-ip"]
  );
});

test("inventario reconhece todas as origens suportadas", () => {
  assert.deepEqual(
    [...supportedAssetSources].sort(),
    ["agent", "manual", "mock", "ocs", "zabbix"]
  );
});
