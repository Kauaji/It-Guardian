import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchAssetAvailability,
  fetchCriticalAssets,
  fetchStatusOverview,
  fetchTopAssetsCpu,
  fetchTopAssetsRam
} from "./assetWidgets.js";

function device(overrides = {}) {
  return { id: "asset-1", name: "Ativo 1", status: "online", metrics: { cpu: 10, ram: 10, disk: 10 }, ...overrides };
}

function fakeCtx({
  devices = [],
  activeAlerts = [],
  allAlerts = [],
  serviceOrders = [],
  serviceOrderSettings = { statuses: [{ id: "open", isFinal: false }, { id: "closed", isFinal: true }] }
} = {}) {
  return {
    getDevices: async () => devices,
    getActiveAlerts: async () => activeAlerts,
    getAllAlerts: async () => allAlerts,
    getServiceOrders: async () => serviceOrders,
    getServiceOrderSettings: async () => serviceOrderSettings
  };
}

test("fetchAssetAvailability conta dispositivos reais por status, sem inventar categorias", async () => {
  const ctx = fakeCtx({
    devices: [device({ status: "online" }), device({ id: "2", status: "offline" }), device({ id: "3", status: "problem" })]
  });
  const result = await fetchAssetAvailability({}, ctx);
  assert.deepEqual(result, { total: 3, byStatus: { online: 1, offline: 1, problem: 1, unknown: 0 } });
});

test("fetchAssetAvailability nao quebra com nenhum dispositivo", async () => {
  const result = await fetchAssetAvailability({}, fakeCtx());
  assert.deepEqual(result, { total: 0, byStatus: { online: 0, offline: 0, problem: 0, unknown: 0 } });
});

test("fetchTopAssetsCpu ordena por valor atual e ignora ativos sem metrica", async () => {
  const ctx = fakeCtx({
    devices: [
      device({ id: "1", metrics: { cpu: 40 } }),
      device({ id: "2", metrics: { cpu: 90 } }),
      device({ id: "3", metrics: null }),
      device({ id: "4", metrics: { cpu: 60 } })
    ]
  });
  const result = await fetchTopAssetsCpu({}, ctx);
  assert.equal(result.metric, "cpu");
  assert.equal(result.basis, "current");
  assert.deepEqual(result.rows.map((row) => row.id), ["2", "4", "1"]);
});

test("fetchTopAssetsRam respeita o limite configurado, entre 1 e 15", async () => {
  const devices = Array.from({ length: 10 }, (_, index) => device({ id: String(index), metrics: { ram: index } }));
  const result = await fetchTopAssetsRam({ limit: 3 }, fakeCtx({ devices }));
  assert.equal(result.rows.length, 3);

  const clampedHigh = await fetchTopAssetsRam({ limit: 999 }, fakeCtx({ devices }));
  assert.equal(clampedHigh.limit, 15);
});

test("fetchCriticalAssets inclui ativos com status problem ou metrica critica, sem duplicar criterios", async () => {
  const ctx = fakeCtx({
    devices: [
      device({ id: "1", status: "problem" }),
      device({ id: "2", status: "online", metrics: { cpu: 95 } }),
      device({ id: "3", status: "online", metrics: { cpu: 10 } })
    ]
  });
  const result = await fetchCriticalAssets({}, ctx);
  assert.deepEqual(result.rows.map((row) => row.id).sort(), ["1", "2"]);
});

test("fetchStatusOverview calcula a saude a partir de fontes reais e nunca de valor fixo", async () => {
  const ctx = fakeCtx({
    devices: [device({ id: "1", status: "online" }), device({ id: "2", status: "offline" })],
    activeAlerts: [{ severity: "critical" }],
    allAlerts: [],
    serviceOrders: [{ id: "os-1", status: "open" }],
    serviceOrderSettings: { statuses: [{ id: "open", isFinal: false }] }
  });
  const result = await fetchStatusOverview({}, ctx);
  assert.equal(result.totalAssets, 2);
  assert.equal(result.onlineAssets, 1);
  assert.equal(result.offlineAssets, 1);
  assert.equal(result.openServiceOrders, 1);
  assert.equal(result.criticalAlerts, 1);
  assert.ok(result.health.score >= 0 && result.health.score <= 100);
  assert.ok(["healthy", "attention", "critical", "emergency"].includes(result.health.classification));
});
