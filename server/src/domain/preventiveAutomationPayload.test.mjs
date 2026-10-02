import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUniqueOverrides,
  normalizeOverridePayload,
  normalizePlanPayload
} from "./preventiveAutomationPayload.js";

const validPayload = (overrides = {}) => ({ name: "Plano valido", scopeType: "all", ...overrides });

test("plano com escopo all usa padroes e ignora scopeId", () => {
  const plan = normalizePlanPayload(validPayload({ scopeId: "ignorado", defaultScriptIds: [" s1 ", "s1", "s2"] }));

  assert.equal(plan.name, "Plano valido");
  assert.equal(plan.active, true);
  assert.equal(plan.recurrenceType, "monthly");
  assert.equal(plan.recurrenceInterval, 30);
  assert.equal(plan.preferredTime, "08:00");
  assert.equal(plan.timezone, "America/Sao_Paulo");
  assert.equal(plan.scopeId, null);
  assert.deepEqual(plan.assetIds, []);
  assert.deepEqual(plan.defaultScriptIds, ["s1", "s2"]);
  assert.equal(plan.indicatorColor, "#1f7a61");
  assert.equal(plan.overrides, undefined);
  assert.equal(plan.preventivePlanId, null);
});

test("edicao herda valores do plano atual e permite sobrescrever campos", () => {
  const current = {
    name: "Plano atual",
    description: "descricao",
    notes: "notas",
    active: false,
    recurrenceType: "weekly",
    recurrenceIntervalDays: 7,
    preferredTime: "09:30",
    timezone: "America/Manaus",
    scopeType: "asset_list",
    assetIds: ["a1", "a2"],
    excludedAssetIds: ["x"],
    defaultScriptIds: ["s1"],
    indicatorColor: "#123456",
    preventivePlanId: "pp-1"
  };

  const unchanged = normalizePlanPayload({}, current);
  assert.equal(unchanged.name, "Plano atual");
  assert.equal(unchanged.active, false);
  assert.equal(unchanged.recurrenceType, "weekly");
  assert.equal(unchanged.preferredTime, "09:30");
  assert.equal(unchanged.timezone, "America/Manaus");
  assert.deepEqual(unchanged.assetIds, ["a1", "a2"]);
  assert.deepEqual(unchanged.excludedAssetIds, ["x"]);
  assert.equal(unchanged.preventivePlanId, "pp-1");

  const changed = normalizePlanPayload({ name: "Novo nome", active: true, asset_ids: ["a3"], preventive_plan_id: "pp-2" }, current);
  assert.equal(changed.name, "Novo nome");
  assert.equal(changed.active, true);
  assert.deepEqual(changed.assetIds, ["a3"]);
  assert.equal(changed.preventivePlanId, "pp-2");
});

test("erros de validacao do plano tem status 400 e mensagens especificas", () => {
  const failures = [
    [validPayload({ name: "ab" }), /pelo menos 3 caracteres/],
    [validPayload({ scopeType: "segment" }), /Informe o escopo/],
    [validPayload({ scopeType: "asset_list" }), /deve ser uma lista/],
    [validPayload({ scopeType: "asset_list", assetIds: [] }), /pelo menos uma maquina/],
    [validPayload({ assetIds: ["a1"] }), /so pode ser usado com o escopo asset_list/],
    [validPayload({ assetIds: "a1" }), /so pode ser usado com o escopo asset_list/],
    [validPayload({ recurrenceType: "custom_days" }), /quantidade de dias/]
  ];

  for (const [payload, pattern] of failures) {
    assert.throws(() => normalizePlanPayload(payload), (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, pattern);
      return true;
    });
  }

  assert.deepEqual(normalizePlanPayload(validPayload({ assetIds: null })).assetIds, []);
  assert.deepEqual(normalizePlanPayload(validPayload({ assetIds: [] })).assetIds, []);
  assert.equal(normalizePlanPayload(validPayload({ recurrenceType: "custom_days", recurrenceInterval: 12 })).recurrenceInterval, 12);
});

test("override normaliza alvo, recorrencia e horario", () => {
  const byAsset = normalizeOverridePayload({ assetId: " a1 ", recurrenceType: "weekly", preferredTime: "07:15", active: "false" });
  assert.deepEqual(byAsset, {
    assetId: "a1",
    segmentId: null,
    targetKey: "asset:a1",
    recurrenceType: "weekly",
    recurrenceInterval: 7,
    preferredTime: "07:15",
    active: false
  });

  const bySegment = normalizeOverridePayload({ segmentId: "s1", recurrenceType: "custom_days", recurrenceIntervalDays: 4 });
  assert.equal(bySegment.targetKey, "segment:s1");
  assert.equal(bySegment.recurrenceInterval, 4);
  assert.equal(bySegment.preferredTime, null);
  assert.equal(bySegment.active, true);

  assert.equal(normalizeOverridePayload({}), null);
  assert.throws(() => normalizeOverridePayload({ assetId: "a1", segmentId: "s1" }), { statusCode: 400 });
  assert.throws(() => normalizeOverridePayload({ assetId: "a1", recurrenceType: "custom_days" }), { statusCode: 400 });
});

test("overrides duplicados no mesmo alvo geram conflito 409 com codigo estavel", () => {
  assert.doesNotThrow(() => assertUniqueOverrides([{ assetId: "a1" }, { assetId: "a2" }, { segmentId: "s1" }, {}]));
  assert.doesNotThrow(() => assertUniqueOverrides());

  assert.throws(() => assertUniqueOverrides([{ assetId: "a1" }, { targetKey: "asset:a1" }]), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.code, "DUPLICATE_PREVENTIVE_AUTOMATION_OVERRIDE");
    assert.match(error.message, /Esta máquina/);
    return true;
  });
  assert.throws(() => assertUniqueOverrides([{ segmentId: "s1" }, { segmentId: "s1" }]), /Este segmento/);
});
