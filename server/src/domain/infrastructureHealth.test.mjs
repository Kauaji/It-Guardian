import assert from "node:assert/strict";
import test from "node:test";
import { calculateInfrastructureHealth } from "./infrastructureHealth.js";

test("ambiente sem ativos e sem problemas fica saudavel com nota maxima", () => {
  const result = calculateInfrastructureHealth({});
  assert.equal(result.score, 100);
  assert.equal(result.classification, "healthy");
  assert.equal(result.classificationLabel, "Saudavel");
  assert.deepEqual(result.deductions, []);
});

test("parque totalmente online e sem alertas permanece saudavel", () => {
  const result = calculateInfrastructureHealth({ totalAssets: 20, offlineAssets: 0 });
  assert.equal(result.score, 100);
  assert.equal(result.classification, "healthy");
});

test("metade do parque offline derruba a nota para faixa critica ou pior", () => {
  const result = calculateInfrastructureHealth({ totalAssets: 10, offlineAssets: 5 });
  assert.equal(result.score, 80);
  assert.equal(result.classification, "attention");
  assert.ok(result.deductions.some((item) => item.reason.includes("50%")));
});

test("cada fator tem teto de deducao proprio (nao domina a nota sozinho)", () => {
  const manyCriticalAlerts = calculateInfrastructureHealth({
    totalAssets: 10,
    offlineAssets: 0,
    criticalAlerts: 50
  });
  assert.equal(manyCriticalAlerts.score, 80);

  const manyOverdueOrders = calculateInfrastructureHealth({
    totalAssets: 10,
    offlineAssets: 0,
    overdueServiceOrders: 50
  });
  assert.equal(manyOverdueOrders.score, 85);
});

test("nota nunca fica negativa mesmo com todos os fatores no maximo", () => {
  const result = calculateInfrastructureHealth({
    totalAssets: 10,
    offlineAssets: 10,
    criticalAlerts: 50,
    overdueServiceOrders: 50,
    criticalDiskAssets: 50,
    criticalPerformanceAssets: 50,
    staleHeartbeatAssets: 50,
    recurringProblemAssets: 50
  });
  assert.equal(result.score, 0);
  assert.equal(result.classification, "emergency");
});

test("classificacao segue os limiares documentados", () => {
  assert.equal(calculateInfrastructureHealth({ totalAssets: 100, offlineAssets: 0 }).classification, "healthy");
  assert.equal(
    calculateInfrastructureHealth({ totalAssets: 100, offlineAssets: 45 }).classification,
    "attention"
  );
  assert.equal(
    calculateInfrastructureHealth({ totalAssets: 100, offlineAssets: 80 }).classification,
    "critical"
  );
  assert.equal(
    calculateInfrastructureHealth({ totalAssets: 100, offlineAssets: 100, criticalAlerts: 10 }).classification,
    "emergency"
  );
});

test("deducoes explicam a nota em texto legivel para o tooltip", () => {
  const result = calculateInfrastructureHealth({
    totalAssets: 10,
    offlineAssets: 2,
    criticalAlerts: 1,
    criticalDiskAssets: 1
  });
  assert.ok(result.deductions.length >= 3);
  for (const deduction of result.deductions) {
    assert.equal(typeof deduction.reason, "string");
    assert.ok(deduction.reason.length > 0);
    assert.ok(deduction.points > 0);
  }
});
