import assert from "node:assert/strict";
import test from "node:test";
import { finiteNumber, normalizeLinkPayload, normalizeMapPayload, normalizeNodePayload, nullableText } from "./topologyPayload.js";

const fails = (fn, pattern) => assert.throws(fn, (error) => error.statusCode === 400 && error.expose === true && pattern.test(error.message));

test("mapa de rede: nome minimo, escopo valido e preservacao do existente", () => {
  assert.deepEqual(normalizeMapPayload({ name: " Matriz " }), { name: "Matriz", scopeType: "global", scopeId: null });
  assert.deepEqual(normalizeMapPayload({ scope_type: "segment", scope_id: " s1 " }, { name: "Atual" }), { name: "Atual", scopeType: "segment", scopeId: "s1" });
  assert.deepEqual(normalizeMapPayload({ name: "Novo" }, { name: "Atual", scopeType: "group", scopeId: "g1" }), { name: "Novo", scopeType: "group", scopeId: "g1" });
  fails(() => normalizeMapPayload({ name: "x" }), /nome para o mapa/);
  fails(() => normalizeMapPayload({ name: "Mapa", scopeType: "planeta" }), /Escopo/);
});

test("no: ativo exige assetId, segmento/grupo exige refId e coordenadas invalidas caem no existente", () => {
  assert.deepEqual(normalizeNodePayload({ assetId: "a1", x: "10", y: "abc", pinned: 1 }, { y: 7 }), {
    nodeType: "asset", assetId: "a1", refId: null, x: 10, y: 7, pinned: true, labelOverride: null
  });
  assert.deepEqual(normalizeNodePayload({ node_type: "segment", ref_id: "s1", label_override: " Rotulo " }), {
    nodeType: "segment", assetId: null, refId: "s1", x: 0, y: 0, pinned: false, labelOverride: "Rotulo"
  });
  assert.equal(normalizeNodePayload({}, { nodeType: "group", refId: "g9" }).refId, "g9");
  fails(() => normalizeNodePayload({}), /ativo a ser posicionado/);
  fails(() => normalizeNodePayload({ nodeType: "group" }), /segmento ou grupo/);
  fails(() => normalizeNodePayload({ nodeType: "nuvem" }), /Tipo de no/);
});

test("conexao: tipos iguais, dois lados diferentes, tipo e status validos", () => {
  assert.deepEqual(normalizeLinkPayload({ sourceAssetId: "a", targetAssetId: "b", type: "fiber", statusOverride: "manual", label: " L " }), {
    sourceType: "asset", targetType: "asset", sourceAssetId: "a", targetAssetId: "b", label: "L", type: "fiber", statusOverride: "manual", description: null
  });
  assert.equal(normalizeLinkPayload({ source_asset_id: "a", target_asset_id: "b" }).type, "unknown");
  assert.equal(normalizeLinkPayload({ label: "novo" }, { sourceAssetId: "a", targetAssetId: "b", description: "d" }).description, "d");
  fails(() => normalizeLinkPayload({ sourceAssetId: "a", targetAssetId: "b", sourceType: "group" }), /mesmo tipo/);
  fails(() => normalizeLinkPayload({ sourceType: "x", targetType: "x", sourceAssetId: "a", targetAssetId: "b" }), /Tipo de no da conexao/);
  fails(() => normalizeLinkPayload({ sourceAssetId: "a" }), /dois lados/);
  fails(() => normalizeLinkPayload({ sourceAssetId: "a", targetAssetId: "a" }), /ele mesmo/);
  fails(() => normalizeLinkPayload({ sourceAssetId: "a", targetAssetId: "b", type: "radio" }), /Tipo de conexao/);
  fails(() => normalizeLinkPayload({ sourceAssetId: "a", targetAssetId: "b", statusOverride: "quebrado" }), /Status de conexao/);
});

test("auxiliares de texto e numero", () => {
  assert.equal(nullableText("  "), null);
  assert.equal(nullableText(undefined), null);
  assert.equal(nullableText(" x "), "x");
  assert.equal(finiteNumber("3.5", 0), 3.5);
  assert.equal(finiteNumber("x", 9), 9);
});
