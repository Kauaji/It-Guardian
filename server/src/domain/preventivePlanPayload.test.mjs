import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRiskAcknowledged,
  buildAssetRegistrationLog,
  buildLinkedAutomationPayload,
  buildServiceOrderDraft,
  normalizePreventivePlanPayload,
  normalizePreventivePlanStatus,
  summarizeAutomation
} from "./preventivePlanPayload.js";

test("payload do plano preventivo normaliza campos e remove duplicados", () => {
  const normalized = normalizePreventivePlanPayload({
    name: "  Plano trimestral  ",
    description: "x".repeat(600),
    assetIds: [" a1 ", "a1", "", "a2"],
    scriptIds: ["s1", "s1"],
    riskAcknowledged: "true",
    status: "COMPLETED",
    originAlertId: " alerta ",
    notes: " nota "
  });

  assert.equal(normalized.name, "Plano trimestral");
  assert.equal(normalized.description.length, 500);
  assert.deepEqual(normalized.assetIds, ["a1", "a2"]);
  assert.deepEqual(normalized.scriptIds, ["s1"]);
  assert.equal(normalized.riskAcknowledged, false, "somente o booleano true confirma o risco");
  assert.equal(normalized.status, "completed");
  assert.equal(normalized.source, "manual");
  assert.equal(normalized.originAlertId, "alerta");
  assert.equal(normalized.originSuggestionId, null);
  assert.equal(normalized.notes, "nota");
});

test("payload invalido gera erros 400 especificos", () => {
  const base = { name: "Plano ok", assetIds: ["a1"], scriptIds: ["s1"] };
  const failures = [
    [{ ...base, name: "ab" }, /pelo menos 3 caracteres/],
    [{ ...base, assetIds: [] }, /pelo menos uma máquina/],
    [{ ...base, assetIds: "a1" }, /pelo menos uma máquina/],
    [{ ...base, scriptIds: [] }, /pelo menos uma verificação/],
    [undefined, /pelo menos 3 caracteres/]
  ];
  for (const [payload, pattern] of failures) {
    assert.throws(
      () => normalizePreventivePlanPayload(payload),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, pattern);
        return true;
      }
    );
  }
});

test("status desconhecido volta ao padrao", () => {
  assert.equal(normalizePreventivePlanStatus("simulated"), "simulated");
  assert.equal(normalizePreventivePlanStatus("outro"), "prepared");
  assert.equal(normalizePreventivePlanStatus(undefined, "failed"), "failed");
});

test("script de alto risco exige confirmacao extra", () => {
  assert.doesNotThrow(() => assertRiskAcknowledged([{ riskLevel: "low" }, { suggestedRiskLevel: "medium" }], false));
  assert.doesNotThrow(() => assertRiskAcknowledged([{ riskLevel: "critical" }], true));
  assert.throws(() => assertRiskAcknowledged([{ riskLevel: "high" }], false), { statusCode: 400 });
  assert.throws(() => assertRiskAcknowledged([{ suggestedRiskLevel: "critical" }], false), /alto risco/);
});

test("resumo da automacao vinculada tem padroes seguros", () => {
  assert.deepEqual(summarizeAutomation(null), { enabled: false });

  const summary = summarizeAutomation({ id: "au1", preventivePlanId: "pp1", name: "Auto", recurrenceType: "weekly" });
  assert.equal(summary.enabled, true);
  assert.equal(summary.active, true);
  assert.deepEqual(summary.assetIds, []);
  assert.deepEqual(summary.defaultScriptIds, []);
  assert.deepEqual(summary.overrides, []);
  assert.deepEqual(summary.assetSchedules, []);
  assert.equal(summary.overrideCount, 0);
  assert.equal(summary.notes, "");
  assert.equal(summarizeAutomation({ id: "x", active: false }).active, false);
});

test("textos e payload derivados do plano", () => {
  assert.match(
    buildAssetRegistrationLog({ assetId: "a1", scriptNames: "um, dois", automationEnabled: true }),
    /Execução será iniciada pela agenda/
  );
  assert.match(buildAssetRegistrationLog({ assetId: "a1", scriptNames: "um", automationEnabled: false }), /Scripts enfileirados/);

  const linked = buildLinkedAutomationPayload({
    automationPayload: { enabled: true, name: "", recurrenceType: "weekly", active: false, scopeType: "all", assetIds: ["x"] },
    planId: "pp1",
    normalized: { name: "Plano base", description: "desc", notes: "nota", assetIds: ["a1"], scriptIds: ["s1"] }
  });
  assert.equal(linked.name, "Plano base");
  assert.equal(linked.description, "desc");
  assert.equal(linked.notes, "nota");
  assert.equal(linked.preventivePlanId, "pp1");
  assert.equal(linked.scopeType, "asset_list");
  assert.deepEqual(linked.assetIds, ["a1"]);
  assert.deepEqual(linked.defaultScriptIds, ["s1"]);
  assert.equal(linked.active, false);
  assert.equal(linked.recurrenceType, "weekly");
  assert.equal(buildLinkedAutomationPayload({ planId: "p", normalized: { name: "n", assetIds: [], scriptIds: [] } }).active, true);
});

test("OS preventiva descreve maquinas e verificacoes sem executar comandos", () => {
  const single = buildServiceOrderDraft({
    plan: { id: "pp1", name: "Plano", assets: [{ assetId: "a1" }], scripts: [{ scriptName: "Limpeza" }, { name: "Disco" }, {}] },
    user: { name: "Ana" }
  });
  assert.deepEqual(single.assetIds, ["a1"]);
  assert.equal(single.payload.title, "Manutenção preventiva — a1");
  assert.equal(single.payload.assetId, "a1");
  assert.equal(single.payload.requesterName, "Ana");
  assert.equal(single.payload.assignedTechnicianName, "Ana");
  assert.equal(single.payload.preventivePlanId, "pp1");
  assert.equal(single.payload.autoPriorityEnabled, false);
  assert.match(single.payload.description, /Verificações selecionadas: Limpeza, Disco\./);
  assert.match(single.payload.notes, /Nenhum comando foi executado automaticamente\./);

  const multiple = buildServiceOrderDraft({
    plan: { id: "pp2", name: "Outro", assets: [{ assetId: "a1" }, { assetId: "a2" }], scripts: [] },
    user: null
  });
  assert.equal(multiple.payload.title, "Manutenção preventiva — 2 máquina(s)");
  assert.equal(multiple.payload.assetId, null);
  assert.equal(multiple.payload.requesterName, "Técnico");
  assert.equal(multiple.payload.assignedTechnicianName, null);
  assert.match(multiple.payload.description, /Nenhuma verificação selecionada/);

  const empty = buildServiceOrderDraft({ plan: { id: "pp3", name: "Vazio" }, user: null });
  assert.match(empty.payload.description, /Nenhuma máquina vinculada/);
  assert.equal(empty.payload.title, "Manutenção preventiva — 0 máquina(s)");
});
