import assert from "node:assert/strict";
import test from "node:test";

import { describeScriptForDiagnosis, executionDiagnosisContextPermissions, isScriptDiagnosisSatisfied } from "./executionDiagnosis.js";
import {
  assertExecutionConfirmed,
  assertRiskAcknowledged,
  assertScriptAvailable,
  assertSuggestionAcceptsScripts,
  buildQueuedExecutionRawLog,
  clampValidationWindowMinutes,
  isHighRiskScript,
  resolveObservationOutcome
} from "./usagePolicy.js";

test("sugestoes so aceitam script nos estados que permitem nova observacao", () => {
  for (const status of ["pending", "observed_persistent", "insufficient_data", "validation_cancelled"]) {
    assert.doesNotThrow(() => assertSuggestionAcceptsScripts({ status }), status);
  }
  for (const status of ["accepted", "rejected", "observed_resolved", "validated", undefined]) {
    assert.throws(
      () => assertSuggestionAcceptsScripts({ status }),
      (error) => error.statusCode === 409,
      String(status)
    );
  }
});

test("script precisa existir e estar ativo", () => {
  assert.doesNotThrow(() => assertScriptAvailable({ id: "s1" }));
  assert.doesNotThrow(() => assertScriptAvailable({ id: "s1", active: true }));
  assert.throws(
    () => assertScriptAvailable(null),
    (error) => error.statusCode === 404
  );
  assert.throws(
    () => assertScriptAvailable({ id: "s1", active: false }),
    (error) => error.statusCode === 404
  );
});

test("execucao exige confirmacao explicita e risco alto exige confirmacao extra", () => {
  assert.doesNotThrow(() => assertExecutionConfirmed({ confirmed: true }));
  for (const payload of [{}, { confirmed: "true" }, { confirmed: 1 }, { confirmed: false }]) {
    assert.throws(
      () => assertExecutionConfirmed(payload),
      (error) => error.statusCode === 400
    );
  }

  assert.equal(isHighRiskScript({ riskLevel: "high" }), true);
  assert.equal(isHighRiskScript({ riskLevel: "critical" }), true);
  assert.equal(isHighRiskScript({ riskLevel: "low" }), false);
  assert.equal(isHighRiskScript({ suggestedRiskLevel: "critical" }), true, "usa o risco sugerido quando nao ha risco cadastrado");
  assert.equal(isHighRiskScript({}), false, "sem risco informado assume medio");

  assert.doesNotThrow(() => assertRiskAcknowledged({ riskLevel: "high" }, { riskAcknowledged: true }, "msg"));
  assert.doesNotThrow(() => assertRiskAcknowledged({ riskLevel: "low" }, {}, "msg"));
  assert.throws(
    () => assertRiskAcknowledged({ riskLevel: "critical" }, { riskAcknowledged: "true" }, "Confirmacao extra"),
    (error) => error.statusCode === 400 && error.message === "Confirmacao extra"
  );
});

test("janela de observacao fica entre 5 minutos e 7 dias", () => {
  assert.equal(clampValidationWindowMinutes(undefined, undefined), 30);
  assert.equal(clampValidationWindowMinutes(undefined, 45), 45);
  assert.equal(clampValidationWindowMinutes(60, 45), 60);
  assert.equal(clampValidationWindowMinutes(1, 45), 5);
  assert.equal(clampValidationWindowMinutes(999999, 45), 10080);
  assert.equal(clampValidationWindowMinutes("90", 45), 90);
  assert.equal(clampValidationWindowMinutes(12.6, 45), 13);
  assert.equal(clampValidationWindowMinutes("abc", 45), 45, "valor nao numerico cai para o configurado");
  assert.equal(clampValidationWindowMinutes("abc", "xyz"), 30, "configurado invalido cai para o padrao");
});

test("log do enfileiramento descreve a origem e que nada foi executado pelo servidor", () => {
  const fromSuggestion = buildQueuedExecutionRawLog("suggestion");
  const fromOrder = buildQueuedExecutionRawLog("serviceOrder");

  assert.match(fromSuggestion, /^Execução solicitada a partir de sugestão de OS\./);
  assert.match(fromOrder, /^Execução solicitada a partir de uma Ordem de Serviço\./);
  for (const text of [fromSuggestion, fromOrder]) {
    assert.match(text, /O servidor apenas enfileirou o script cadastrado\./);
    assert.match(text, /Aguardando o agente autenticado/);
    assert.equal(text.split("\n").length, 3);
  }
});

test("desfecho da observacao depende do estado do aviso", () => {
  assert.equal(resolveObservationOutcome({ alertId: "a1", alertStatus: "resolved" }).status, "observed_resolved");
  assert.equal(resolveObservationOutcome({ alertId: "a1", alertStatus: "active" }).status, "observed_persistent");
  assert.equal(resolveObservationOutcome({ alertId: "a1", alertStatus: "acknowledged" }).status, "observed_persistent");
  assert.equal(resolveObservationOutcome({ alertId: null, alertStatus: "resolved" }).status, "insufficient_data");
  assert.equal(resolveObservationOutcome({ alertId: "a1", alertStatus: null }).status, "insufficient_data");
  assert.match(resolveObservationOutcome({ alertId: "a1", alertStatus: "resolved" }).resultSummary, /não voltou/);
  assert.match(resolveObservationOutcome({}).resultSummary, /Nenhum comando foi executado/);
});

test("diagnostico do script descreve atividade, tipo e controle duplo", () => {
  const user = { id: "u1" };

  assert.deepEqual(describeScriptForDiagnosis({ active: true, type: "powershell", riskLevel: "low" }, user), {
    scriptActive: true,
    scriptTypeAllowed: true,
    riskLevel: "low",
    riskRequiresSecondReviewer: false,
    secondReviewerSatisfied: null
  });
  assert.equal(describeScriptForDiagnosis({ active: false, type: "shell", riskLevel: "low" }, user).scriptActive, false);
  assert.equal(describeScriptForDiagnosis({ type: "shell" }, user).scriptTypeAllowed, false);

  const sameEditor = describeScriptForDiagnosis({ type: "bat", riskLevel: "high", contentUpdatedBy: "u1" }, user);
  assert.equal(sameEditor.riskRequiresSecondReviewer, true);
  assert.equal(sameEditor.secondReviewerSatisfied, false);
  const otherEditor = describeScriptForDiagnosis({ type: "bat", riskLevel: "critical", contentUpdatedBy: "u2" }, user);
  assert.equal(otherEditor.secondReviewerSatisfied, true);
  assert.equal(describeScriptForDiagnosis({ type: "bat", riskLevel: "high" }, user).secondReviewerSatisfied, true);
  assert.equal(describeScriptForDiagnosis({ type: "bat", riskLevel: "high", contentUpdatedBy: "u1" }, null).secondReviewerSatisfied, true);
});

test("script so libera a execucao quando atende ativo, tipo e controle duplo", () => {
  assert.equal(isScriptDiagnosisSatisfied(null, false), true, "sem script selecionado nada a restringir");

  const base = { scriptActive: true, scriptTypeAllowed: true, riskRequiresSecondReviewer: false, secondReviewerSatisfied: null };
  assert.equal(isScriptDiagnosisSatisfied(base, false), true);
  assert.equal(isScriptDiagnosisSatisfied({ ...base, scriptActive: false }, true), false);
  assert.equal(isScriptDiagnosisSatisfied({ ...base, scriptTypeAllowed: false }, true), false);

  const risky = { ...base, riskRequiresSecondReviewer: true, secondReviewerSatisfied: true };
  assert.equal(isScriptDiagnosisSatisfied(risky, true), true);
  assert.equal(isScriptDiagnosisSatisfied(risky, false), false, "falta a permissao de aprovacao");
  assert.equal(isScriptDiagnosisSatisfied({ ...risky, secondReviewerSatisfied: false }, true), false, "mesma pessoa que editou");
});

test("permissao base do diagnostico por ponto de disparo", () => {
  assert.equal(executionDiagnosisContextPermissions.service_order, "service_orders.run_scripts");
  assert.equal(executionDiagnosisContextPermissions.alert, "scripts.use_from_alert");
});
