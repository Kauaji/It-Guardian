import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentAlerts } from "./alertService.js";

const now = new Date("2026-07-29T12:00:00.000Z");

function agentAsset(overrides = {}) {
  return {
    id: "asset-real-1",
    hostname: "DESKTOP-REAL",
    machineAlias: "Computador real",
    lastSeenAt: "2026-07-29T11:59:00.000Z",
    collectedAt: "2026-07-29T11:59:00.000Z",
    intervalSeconds: 300,
    cpuUsagePercent: 35,
    memoryUsedBytes: 4_000,
    memoryTotalBytes: 10_000,
    diskFreeBytes: 60_000,
    diskTotalBytes: 100_000,
    ...overrides
  };
}

test("gera alertas somente para metricas reais acima do limite", () => {
  const alerts = buildAgentAlerts(agentAsset({
    cpuUsagePercent: 96,
    memoryUsedBytes: 9_000,
    diskFreeBytes: 10_000
  }), now);

  assert.deepEqual(alerts.map((alert) => alert.type).sort(), [
    "cpu_high",
    "disk_high",
    "ram_high"
  ]);
  assert.ok(alerts.every((alert) => alert.source === "agent"));
  assert.ok(alerts.every((alert) => alert.assetId === "asset-real-1"));
});

test("heartbeat atrasado gera aviso offline sem inventar metricas", () => {
  const alerts = buildAgentAlerts(agentAsset({
    lastSeenAt: "2026-07-29T11:30:00.000Z",
    cpuUsagePercent: 99
  }), now);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, "machine_offline");
  assert.equal(alerts[0].source, "agent");
});

test("disco praticamente cheio gera apenas o aviso critico especifico", () => {
  const alerts = buildAgentAlerts(agentAsset({
    diskFreeBytes: 4_000
  }), now);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, "disk_full");
  assert.equal(alerts[0].severity, "critical");
  assert.equal(alerts[0].threshold, 95);
});

test("maquina saudavel e atualizada nao gera aviso", () => {
  assert.deepEqual(buildAgentAlerts(agentAsset(), now), []);
});
