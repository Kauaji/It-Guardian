import assert from "node:assert/strict";
import test from "node:test";
import { fetchMetricGaugeCpu, validateAssetMetricConfig } from "./metricWidgets.js";

test("validateAssetMetricConfig exige assetId nao vazio", () => {
  assert.match(validateAssetMetricConfig(null), /ativo selecionado/);
  assert.match(validateAssetMetricConfig({}), /ativo selecionado/);
  assert.match(validateAssetMetricConfig({ assetId: "" }), /ativo selecionado/);
  assert.match(validateAssetMetricConfig({ assetId: "   " }), /ativo selecionado/);
  assert.equal(validateAssetMetricConfig({ assetId: "asset-1" }), null);
});

test("fetchMetricGaugeCpu devolve estado explicito de indisponivel sem assetId, nunca um valor", async () => {
  const result = await fetchMetricGaugeCpu({}, { getDevices: async () => [] });
  assert.equal(result.available, false);
  assert.equal(result.value, null);
});

test("fetchMetricGaugeCpu devolve indisponivel quando o ativo configurado nao existe mais", async () => {
  const result = await fetchMetricGaugeCpu(
    { assetId: "asset-inexistente" },
    { getDevices: async () => [{ id: "asset-1", name: "Ativo 1", status: "online", metrics: { cpu: 42 } }] }
  );
  assert.equal(result.available, false);
  assert.equal(result.value, null);
});

test("fetchMetricGaugeCpu devolve o valor atual real quando o ativo existe", async () => {
  const result = await fetchMetricGaugeCpu(
    { assetId: "asset-1" },
    { getDevices: async () => [{ id: "asset-1", name: "Ativo 1", status: "online", metrics: { cpu: 42 } }] }
  );
  assert.equal(result.available, true);
  assert.equal(result.value, 42);
  assert.equal(result.assetName, "Ativo 1");
});

test("fetchMetricGaugeCpu nao inventa um valor quando a metrica esta ausente no ativo", async () => {
  const result = await fetchMetricGaugeCpu(
    { assetId: "asset-1" },
    { getDevices: async () => [{ id: "asset-1", name: "Ativo 1", status: "online", metrics: {} }] }
  );
  assert.equal(result.available, true);
  assert.equal(result.value, null);
});
