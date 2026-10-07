import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

// Caracteriza o enriquecimento dos avisos (tipo, impacto, checklist, prioridade,
// recorrencia, localizacao), as correlacoes/insights e a geracao de sugestoes de
// OS antes da divisao de alertRepository/alertService em dominio/repositorio/servico.

const database = await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "alert-enrichment-characterization-secret-32";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");
const { upsertAlert } = await import("../src/repositories/alertRepository.js");
const { listen, login, browserHeaders } = await import("../test-support/scriptFixtures.mjs");

test.after(closeDatabase);

async function api(baseUrl, cookie, method, path, body) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: browserHeaders(cookie),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

function alertFixture(id, overrides = {}) {
  const now = new Date().toISOString();
  return {
    id,
    assetId: `asset-${id}`,
    hostName: `HOST-${id}`,
    type: "cpu_high",
    metric: "CPU",
    title: "CPU acima do limite",
    description: "fixture",
    severity: "high",
    value: 90,
    threshold: 85,
    status: "active",
    firstSeenAt: now,
    lastSeenAt: now,
    occurrencesCount: 1,
    source: "integration_test",
    ...overrides
  };
}

test("avisos enriquecidos, correlacoes, insights e sugestoes de OS", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  await upsertAlert(alertFixture("char-a1", { severity: "critical", value: 96, occurrencesCount: 4 }));
  await upsertAlert(alertFixture("char-a2", { type: "cpu_high" }));
  await upsertAlert(
    alertFixture("char-a3", {
      type: "disk_full",
      metric: "disco",
      title: "Disco cheio",
      severity: "critical",
      value: 97,
      threshold: 95,
      occurrencesCount: 2
    })
  );
  await upsertAlert(
    alertFixture("char-a4", {
      type: "machine_offline",
      metric: "heartbeat",
      title: "Offline",
      severity: "warning",
      value: null,
      threshold: null
    })
  );

  // OS fechada para o mesmo ativo (relatedAssetText = hostName do aviso) -> recorrencia pos-OS
  const order = await api(baseUrl, cookie, "POST", "/service-orders", {
    title: "OS antiga de CPU",
    problemType: "cpu_high",
    category: "Computador",
    relatedAssetText: "HOST-char-a1"
  });
  assert.equal(order.status, 201);
  await api(baseUrl, cookie, "PATCH", `/service-orders/${order.body.serviceOrder.id}/technician`, { assignedTechnicianName: "Tec" });
  const closed = await api(baseUrl, cookie, "PATCH", `/service-orders/${order.body.serviceOrder.id}/status`, { status: "closed" });
  assert.equal(closed.status, 200);

  const active = await api(baseUrl, cookie, "GET", "/alerts");
  assert.equal(active.status, 200);
  const byId = Object.fromEntries(active.body.alerts.filter((alert) => alert.id.startsWith("char-")).map((alert) => [alert.id, alert]));
  const pick = (alert) => ({
    typeLabel: alert.typeLabel,
    category: alert.category,
    operationalImpact: alert.operationalImpact,
    probableCause: alert.probableCause,
    recommendedAction: alert.recommendedAction,
    checklist: alert.checklist,
    confidenceLevel: alert.confidenceLevel,
    trend: alert.trend,
    priorityReason: alert.priorityReason,
    recurrenceScore: alert.recurrenceScore,
    capacityForecast: alert.capacityForecast,
    falsePositiveInsight: alert.falsePositiveInsight,
    location: alert.location,
    relatedStatuses: alert.relatedServiceOrders.map((related) => related.status),
    commentCount: alert.commentCount
  });
  const noGroup = { groupId: null, groupName: "Sem grupo", segmentId: null, segmentName: "Não organizadas" };
  const forecast = (metric, currentValue, threshold) => ({
    available: true,
    summary: "Tendência exige acompanhamento preventivo antes de nova coleta real.",
    metric,
    currentValue,
    threshold
  });

  assert.deepEqual(pick(byId["char-a1"]), {
    typeLabel: "CPU acima do limite",
    category: "Desempenho",
    operationalImpact: "Pode degradar o desempenho e deixar aplicações sem resposta.",
    probableCause: "Processo travado, atualização em execução ou uso excessivo de processamento.",
    recommendedAction: "Identificar processo com alto consumo e validar se há tarefa travada.",
    checklist: [
      "Identificar processo com alto consumo.",
      "Verificar atualizações em execução.",
      "Conferir serviços travados.",
      "Registrar evidências antes de reiniciar."
    ],
    confidenceLevel: "Alta",
    trend: "Em alta",
    priorityReason:
      "Prioridade sugerida porque o aviso está classificado como crítico, houve 4 ocorrências no período configurado, há histórico recente de atendimento para o mesmo ativo.",
    recurrenceScore: 100,
    capacityForecast: forecast("CPU", 96, 85),
    falsePositiveInsight: null,
    location: noGroup,
    relatedStatuses: ["closed"],
    commentCount: 0
  });
  assert.equal(byId["char-a1"].recurrenceInsight.type, "post_service_order_recurrence");
  assert.equal(byId["char-a1"].recurrenceInsight.summary, `Aviso voltou 1 dia(s) após a OS ${closed.body.serviceOrder.number}.`);
  assert.equal(byId["char-a1"].recurrenceInsight.serviceOrderId, order.body.serviceOrder.id);

  const a2 = pick(byId["char-a2"]);
  assert.equal(a2.confidenceLevel, "Baixa");
  assert.equal(a2.trend, "Pontual");
  assert.equal(a2.priorityReason, "Prioridade sugerida porque o aviso ainda tem baixa recorrência e precisa de validação manual.");
  assert.equal(a2.recurrenceScore, 22);
  assert.deepEqual(a2.capacityForecast, forecast("CPU", 90, 85));
  assert.deepEqual(a2.relatedStatuses, []);
  assert.equal(byId["char-a2"].recurrenceInsight, null);

  const a3 = pick(byId["char-a3"]);
  assert.equal(a3.typeLabel, "Disco praticamente cheio");
  assert.equal(a3.category, "Armazenamento");
  assert.equal(a3.trend, "Recorrente");
  assert.equal(a3.recurrenceScore, 64);
  assert.equal(
    a3.priorityReason,
    'Prioridade sugerida porque o aviso está classificado como crítico, o tipo "Disco praticamente cheio" tem impacto operacional alto.'
  );
  assert.deepEqual(a3.capacityForecast, forecast("disco", 97, 95));
  assert.deepEqual(a3.checklist, [
    "Confirmar o volume e o espaço livre.",
    "Remover somente temporários e dados autorizados.",
    "Revisar logs, cache e backups locais.",
    "Avaliar expansão do armazenamento."
  ]);

  const a4 = pick(byId["char-a4"]);
  assert.equal(a4.typeLabel, "Máquina offline");
  assert.equal(a4.category, "Disponibilidade");
  assert.equal(a4.priorityReason, 'Prioridade sugerida porque o tipo "Máquina offline" tem impacto operacional alto.');
  assert.deepEqual(a4.capacityForecast, { available: false, summary: "Sem dados históricos suficientes para previsão de capacidade." });
  assert.deepEqual(a4.location, noGroup);

  // correlacao: dois avisos do mesmo tipo e localizacao
  const corr = await api(baseUrl, cookie, "GET", "/alerts/correlations");
  const cpuGroup = corr.body.correlations.find((item) => item.correlationKey === "cpu_high:Sem grupo:Não organizadas");
  assert.ok(cpuGroup);
  assert.equal(cpuGroup.id, "corr-cpu_high:Sem grupo:Não organizadas");
  assert.equal(cpuGroup.impactLevel, "critical");
  assert.equal(cpuGroup.confidenceLevel, "Alta");
  assert.match(cpuGroup.correlationSummary, /^\d+ aviso\(s\) de CPU acima do limite em Sem grupo \/ Não organizadas\.$/);
  assert.ok(["char-a1", "char-a2"].every((id) => cpuGroup.relatedAlerts.some((related) => related.id === id)));

  // insights
  const insights = (await api(baseUrl, cookie, "GET", "/alerts/insights")).body.insights;
  assert.deepEqual(
    insights.recurrences.filter((item) => item.alertId.startsWith("char-")).map((item) => [item.alertId, item.type]),
    [["char-a1", "post_service_order_recurrence"]]
  );
  const capacity = Object.fromEntries(
    insights.capacity.filter((item) => item.alertId.startsWith("char-")).map((item) => [item.alertId, item.forecast.available])
  );
  assert.deepEqual(capacity, { "char-a1": true, "char-a2": true, "char-a3": true, "char-a4": false });

  // sugestoes: criadas uma unica vez, com prioridade da regra e enriquecimento
  const evaluate = async () => api(baseUrl, cookie, "POST", "/alerts/evaluate");
  const first = await evaluate();
  assert.equal(first.status, 200);
  const createdMine = first.body.createdSuggestions.filter((item) => /HOST-char-/.test(item.title));
  assert.deepEqual(createdMine.map((item) => [item.title, item.suggestedPriority, item.occurrencesCount, item.status]).sort(), [
    ["CPU alta em HOST-char-a1", "high", 4, "pending"],
    ["CPU alta em HOST-char-a2", "high", 1, "pending"],
    ["Disco crítico em HOST-char-a3", "critical", 2, "pending"],
    ["Máquina offline em HOST-char-a4", "critical", 1, "pending"]
  ]);
  const mine = Object.fromEntries(
    first.body.suggestions.filter((item) => /HOST-char-/.test(item.title)).map((item) => [item.alertId, item])
  );
  assert.equal(mine["char-a1"].priorityLabel, "Alta");
  assert.equal(mine["char-a1"].priorityReason, byId["char-a1"].priorityReason);
  assert.equal(mine["char-a1"].recurrenceScore, 100);
  assert.equal(mine["char-a1"].alertSeverity, "critical");
  assert.equal(mine["char-a3"].priorityLabel, "Crítica");
  assert.equal(mine["char-a3"].typeLabel, "Disco praticamente cheio");
  assert.deepEqual(mine["char-a3"].location, noGroup);
  assert.equal(mine["char-a4"].alertSeverity, "warning");
  assert.equal(
    mine["char-a1"].description,
    "O sistema identificou cpu acima do limite acima do limite configurado em 4 ocorrência(s) no período analisado. Recomenda-se análise preventiva do ativo antes de impacto operacional."
  );
  assert.equal(mine["char-a1"].suggestedProblemTypeId, "cpu_high");

  const second = await evaluate();
  assert.equal(second.body.createdSuggestions.length, 0, "reavaliar nao duplica sugestoes");

  // recusar silencia o aviso: reavaliar nao recria nem reabre
  const rejected = await api(baseUrl, cookie, "POST", `/service-order-suggestions/${mine["char-a2"].id}/reject`, {
    reason: "nao e problema"
  });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.suggestion.status, "rejected");
  assert.ok(rejected.body.suggestion.ignoredUntil);
  const silenceMs = new Date(rejected.body.suggestion.ignoredUntil).getTime() - Date.now();
  assert.ok(silenceMs > 23 * 3600e3 && silenceMs <= 24 * 3600e3 + 5000, "silencio padrao de 24h");
  const third = await evaluate();
  assert.equal(third.body.createdSuggestions.length, 0);
  assert.equal(third.body.suggestions.find((item) => item.id === mine["char-a2"].id).status, "rejected");
  const again = await api(baseUrl, cookie, "POST", `/service-order-suggestions/${mine["char-a2"].id}/reject`, {});
  assert.equal(again.status, 409);

  // regra: atualizacao parcial normaliza numeros e booleanos
  const rules = (await api(baseUrl, cookie, "GET", "/alerts/rules")).body.rules;
  assert.deepEqual(
    rules.find((rule) => rule.type === "cpu_high"),
    {
      ...rules.find((rule) => rule.type === "cpu_high"),
      id: "rule-cpu-high",
      threshold: 90,
      durationMinutes: 5,
      recurrenceCount: 3,
      recurrenceWindow: "same_day",
      suggestedPriority: "high",
      createsSuggestion: true,
      enabled: true
    }
  );
  const partial = await api(baseUrl, cookie, "PATCH", "/alerts/rules/rule-cpu-high", {
    threshold: "91",
    durationMinutes: -5,
    recurrenceCount: 0,
    enabled: "false"
  });
  assert.equal(partial.status, 200, JSON.stringify(partial.body));
  assert.equal(partial.body.rule.threshold, 91);
  assert.equal(partial.body.rule.durationMinutes, 0);
  assert.equal(partial.body.rule.recurrenceCount, 1);
  assert.equal(partial.body.rule.enabled, false);
  assert.equal(partial.body.rule.suggestedPriority, "high");
  assert.equal((await api(baseUrl, cookie, "PATCH", "/alerts/rules/nao-existe", { threshold: 1 })).status, 404);
  // propagar a prioridade para sugestoes pendentes usa UPDATE ... FROM (so PostgreSQL real)
  if (database.mode === "postgres") {
    const withPriority = await api(baseUrl, cookie, "PATCH", "/alerts/rules/rule-cpu-high", { suggestedPriority: "critical" });
    assert.equal(withPriority.status, 200, JSON.stringify(withPriority.body));
    assert.equal(withPriority.body.rule.suggestedPriority, "critical");
    const refreshed = (await api(baseUrl, cookie, "POST", "/alerts/evaluate")).body.suggestions;
    assert.equal(refreshed.find((item) => item.id === mine["char-a1"].id).suggestedPriority, "critical");
    assert.equal(refreshed.find((item) => item.id === mine["char-a2"].id).suggestedPriority, "high", "sugestao recusada nao e alterada");
  }

  // configuracoes: valores minimos e cores validas
  const settings = await api(baseUrl, cookie, "PATCH", "/alerts/settings", {
    rejectedAlertSilenceHours: "0",
    preventiveDueDays: 10,
    autoPriority: { enabled: true },
    priorityColors: { low: "red", high: "#aabbcc" }
  });
  assert.equal(settings.status, 200);
  assert.deepEqual(settings.body.settings, {
    rejectedAlertSilenceHours: 1,
    recurrenceCounterResetHours: 24,
    inactiveAlertAutoResolveHours: 48,
    preventiveDueDays: 10,
    scriptValidationWindowMinutes: 30,
    autoPriority: { enabled: true, lowToMediumHours: 24, mediumToHighHours: 48, highToCriticalHours: 72 },
    priorityColors: { low: "#16a34a", medium: "#d97706", high: "#aabbcc", critical: "#dc2626" }
  });
  assert.deepEqual((await api(baseUrl, cookie, "GET", "/alerts/settings")).body.settings, settings.body.settings);
});
