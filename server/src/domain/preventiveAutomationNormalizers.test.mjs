import assert from "node:assert/strict";
import test from "node:test";
import {
  actorName,
  buildOverrideTargetKey,
  normalizeIdList,
  normalizeIndicatorColor,
  normalizePagination,
  normalizeRunStatus,
  normalizeScheduleSlot,
  normalizeScopeType,
  parseJsonArray
} from "./preventiveAutomationNormalizers.js";

test("cor do indicador aceita apenas hexadecimal de seis digitos e normaliza para minusculas", () => {
  assert.equal(normalizeIndicatorColor(" #AABBCC "), "#aabbcc");
  assert.equal(normalizeIndicatorColor("#abc"), "#1f7a61");
  assert.equal(normalizeIndicatorColor("vermelho", "#000000"), "#000000");
  assert.equal(normalizeIndicatorColor(null), "#1f7a61");
});

test("parseJsonArray aceita lista, texto JSON e descarta valores invalidos", () => {
  assert.deepEqual(parseJsonArray(["a"]), ["a"]);
  assert.deepEqual(parseJsonArray('["a","b"]'), ["a", "b"]);
  assert.deepEqual(parseJsonArray('{"a":1}'), []);
  assert.deepEqual(parseJsonArray("nao e json"), []);
  assert.deepEqual(parseJsonArray(null), []);
  assert.deepEqual(parseJsonArray({ objeto: true }), []);
});

test("normalizeIdList remove vazios, espacos e duplicados e ignora entradas que nao sao lista", () => {
  assert.deepEqual(normalizeIdList([" a ", "", "b", "a", null]), ["a", "b"]);
  assert.deepEqual(normalizeIdList("a"), []);
  assert.deepEqual(normalizeIdList(), []);
});

test("escopo e status de execucao desconhecidos voltam ao padrao", () => {
  assert.equal(normalizeScopeType(" SEGMENT "), "segment");
  assert.equal(normalizeScopeType("planeta"), "all");
  assert.equal(normalizeScopeType("planeta", "asset"), "asset");
  assert.equal(normalizeRunStatus("Waiting_Agent"), "waiting_agent");
  assert.equal(normalizeRunStatus("outro"), "scheduled");
});

test("paginacao usa o padrao para valores invalidos e respeita o maximo", () => {
  assert.equal(normalizePagination("10", 100, 500), 10);
  assert.equal(normalizePagination(9999, 100, 500), 500);
  assert.equal(normalizePagination(-1, 100, 500), 100);
  assert.equal(normalizePagination("abc", 100, 500), 100);
  assert.equal(normalizePagination(1.5, 100, 500), 100);
  assert.equal(normalizePagination(undefined, 7, 500), 7);
});

test("janela de agenda e arredondada ao minuto sem alterar a data recebida", () => {
  const original = new Date("2026-03-04T12:34:56.789Z");
  assert.equal(normalizeScheduleSlot(original), "2026-03-04T12:34:00.000Z");
  assert.equal(original.toISOString(), "2026-03-04T12:34:56.789Z");
  assert.equal(normalizeScheduleSlot("2026-03-04T12:34:56.789Z"), "2026-03-04T12:34:00.000Z");
  assert.match(normalizeScheduleSlot("data invalida"), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
});

test("chave do alvo do override identifica maquina ou segmento", () => {
  assert.equal(buildOverrideTargetKey({ assetId: "a1" }), "asset:a1");
  assert.equal(buildOverrideTargetKey({ segmentId: "s1" }), "segment:s1");
  assert.equal(buildOverrideTargetKey({ assetId: "a1", segmentId: "s1" }), "asset:a1");
  assert.equal(buildOverrideTargetKey({}), null);
  assert.equal(buildOverrideTargetKey(), null);
});

test("nome do ator para historico usa nome, e-mail ou Sistema", () => {
  assert.equal(actorName({ name: "Ana", email: "ana@x" }), "Ana");
  assert.equal(actorName({ email: "ana@x" }), "ana@x");
  assert.equal(actorName({ id: "1" }), "Sistema");
  assert.equal(actorName(null), "Sistema");
});
