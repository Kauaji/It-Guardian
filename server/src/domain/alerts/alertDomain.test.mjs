import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentAlerts } from "./agentAlerts.js";
import {
  getAlertCategory,
  getAlertCompactLabel,
  getAlertConfidence,
  getAlertTrend,
  getAlertTypeLabel,
  getPriorityLabel,
  suggestedPriority
} from "./alertCatalog.js";
import {
  buildAlertRuleUpdate,
  decideSuggestionRefresh,
  mergeAlertSettingsUpdate,
  normalizeAlertComment,
  normalizeAlertSettings,
  normalizeSuggestionStatusAfterObservation
} from "./alertConfiguration.js";
import {
  buildAlertCorrelations,
  buildAlertInsights,
  buildCapacityForecast,
  buildEnrichedAlert,
  buildEnrichedSuggestion,
  buildFalsePositiveInsight,
  buildPriorityReason,
  buildRecurrenceInsight,
  buildSuggestionPayload,
  findRelatedOrders,
  getAlertLocation
} from "./alertInsights.js";

test("configuracoes de aviso: minimos, janela do script limitada e cores invalidas", () => {
  const settings = normalizeAlertSettings({
    rejectionSilenceHours: 0,
    inactiveAlertAutoResolveHours: "abc",
    preventiveDueDays: -3,
    scriptValidationWindowMinutes: 999999,
    autoPriority: { enabled: "false", lowToMediumHours: 0 },
    priorityColors: { low: "vermelho", critical: "#ABCDEF" }
  });
  assert.equal(settings.rejectedAlertSilenceHours, 1);
  assert.equal(settings.inactiveAlertAutoResolveHours, 48);
  assert.equal(settings.preventiveDueDays, 1);
  assert.equal(settings.scriptValidationWindowMinutes, 10080);
  assert.equal(settings.autoPriority.enabled, false);
  assert.equal(settings.autoPriority.lowToMediumHours, 1);
  assert.equal(settings.priorityColors.low, "#16a34a");
  assert.equal(settings.priorityColors.critical, "#ABCDEF");
  assert.equal(normalizeAlertSettings({ scriptValidationWindowMinutes: 1 }).scriptValidationWindowMinutes, 5);

  const merged = mergeAlertSettingsUpdate(settings, { preventiveDueDays: 30, autoPriority: { enabled: true } });
  assert.equal(merged.preventiveDueDays, 30);
  assert.equal(merged.autoPriority.enabled, true);
  assert.equal(merged.priorityColors.critical, "#ABCDEF");
  assert.equal(merged.scriptValidationWindowMinutes, 10080);
});

test("regra de aviso: so campos enviados mudam e numeros respeitam minimos", () => {
  const row = {
    threshold: 90,
    duration_minutes: 5,
    recurrence_count: 3,
    recurrence_window: "same_day",
    suggested_priority: "high",
    creates_suggestion: true,
    enabled: true
  };
  assert.deepEqual(buildAlertRuleUpdate(row, {}), {
    threshold: 90,
    durationMinutes: 5,
    recurrenceCount: 3,
    recurrenceWindow: "same_day",
    suggestedPriority: "high",
    createsSuggestion: true,
    enabled: true
  });
  const changed = buildAlertRuleUpdate(row, {
    threshold: "95",
    durationMinutes: -1,
    recurrenceCount: 0,
    recurrenceWindow: " last_24h ",
    suggestedPriority: "inexistente",
    createsSuggestion: "false",
    enabled: false
  });
  assert.equal(changed.threshold, 95);
  assert.equal(changed.durationMinutes, 0);
  assert.equal(changed.recurrenceCount, 1);
  assert.equal(changed.recurrenceWindow, "last_24h");
  assert.equal(changed.suggestedPriority, "high", "prioridade invalida cai na atual");
  assert.equal(changed.createsSuggestion, false);
  assert.equal(changed.enabled, false);
  assert.equal(buildAlertRuleUpdate(row, { threshold: "x" }).threshold, 90);
});

test("comentarios e sugestoes: validacao, silencio e status apos observacao", () => {
  assert.equal(normalizeAlertComment("  ok  "), "ok");
  assert.equal(normalizeAlertComment("a".repeat(2000)).length, 1000);
  assert.throws(
    () => normalizeAlertComment("   "),
    (error) => error.statusCode === 400
  );

  const future = new Date(Date.now() + 3600e3).toISOString();
  const past = new Date(Date.now() - 3600e3).toISOString();
  assert.equal(decideSuggestionRefresh({ status: "accepted" }), "skip_accepted");
  assert.equal(decideSuggestionRefresh({ status: "rejected", ignored_until: future }), "skip_silenced");
  assert.equal(decideSuggestionRefresh({ status: "rejected", rejection_silence_until: future }), "skip_silenced");
  assert.equal(decideSuggestionRefresh({ status: "rejected", ignored_until: past }), "refresh");
  assert.equal(decideSuggestionRefresh({ status: "pending", ignored_until: future }), "refresh");

  assert.equal(normalizeSuggestionStatusAfterObservation("accepted", "observed_resolved"), "accepted");
  assert.equal(normalizeSuggestionStatusAfterObservation("rejected", "validated"), "rejected");
  assert.equal(normalizeSuggestionStatusAfterObservation("pending", "observed_resolved"), "resolved");
  assert.equal(normalizeSuggestionStatusAfterObservation("pending", "validated"), "pending");
});

test("catalogo: rotulos, prioridade sugerida, confianca e tendencia", () => {
  assert.equal(getAlertTypeLabel({ type: "cpu_high" }), "CPU acima do limite");
  assert.equal(getAlertTypeLabel({ type: "desconhecido", title: "Titulo" }), "Titulo");
  assert.equal(getAlertTypeLabel({}), "Aviso de monitoramento");
  assert.equal(getAlertCompactLabel({ type: "disk_full" }), "Disco crítico");
  assert.equal(getAlertCategory({ type: "machine_offline" }), "Disponibilidade");
  assert.equal(suggestedPriority({ type: "disk_full" }), "critical");
  assert.equal(suggestedPriority({ type: "cpu_high", severity: "high" }), "high");
  assert.equal(suggestedPriority({ type: "outro", severity: "warning" }), "medium");
  assert.equal(suggestedPriority({ type: "outro", severity: "info" }), "low");
  assert.equal(suggestedPriority({ type: "outro" }, { suggestedPriority: "critical" }), "critical");
  assert.equal(getAlertConfidence({ severity: "critical", occurrencesCount: 3 }), "Alta");
  assert.equal(getAlertConfidence({ occurrencesCount: 3 }), "Média");
  assert.equal(getAlertConfidence({}), "Baixa");
  assert.equal(getAlertTrend({ occurrencesCount: 4 }), "Em alta");
  assert.equal(getAlertTrend({ occurrencesCount: 2 }), "Recorrente");
  assert.equal(getAlertTrend({}), "Pontual");
  assert.equal(getPriorityLabel("critical"), "Crítica");
  assert.equal(getPriorityLabel("zzz"), "Média");
});

test("insights: OS relacionadas, recorrencia pos-OS, falso positivo e previsao", () => {
  const alert = {
    id: "a1",
    type: "cpu_high",
    metric: "CPU",
    title: "CPU",
    hostName: "PC-1",
    assetId: "as1",
    lastSeenAt: "2026-05-10T00:00:00Z",
    severity: "critical",
    occurrencesCount: 3,
    value: 95,
    threshold: 85
  };
  const orders = [
    { id: "o1", number: "OS-1", assetId: "as1", problemType: "cpu_high", closedAt: "2026-05-08T00:00:00Z", status: "closed" },
    { id: "o2", number: "OS-2", assetId: "outro", problemType: "cpu_high" },
    { id: "o3", number: "OS-3", relatedAssetText: "PC-1", problemType: "cpu_high", status: "open", closedAt: null }
  ];
  const related = findRelatedOrders(alert, orders);
  assert.deepEqual(
    related.map((order) => order.id),
    ["o1", "o3"]
  );
  const recurrence = buildRecurrenceInsight(alert, related);
  assert.equal(recurrence.type, "post_service_order_recurrence");
  assert.equal(recurrence.summary, "Aviso voltou 2 dia(s) após a OS OS-1.");
  assert.equal(buildRecurrenceInsight({ ...alert, lastSeenAt: "2026-06-30T00:00:00Z" }, related), null, "mais de 14 dias");
  assert.equal(buildRecurrenceInsight(alert, []), null);
  assert.match(buildPriorityReason(alert, related), /crítico.*3 ocorrências.*OS aberta relacionada.*histórico recente/);
  assert.equal(
    buildPriorityReason({}, []),
    "Prioridade sugerida porque o aviso ainda tem baixa recorrência e precisa de validação manual."
  );

  const suggestions = [
    { alertId: "a1", status: "rejected" },
    { alertId: "a1", status: "rejected" },
    { alertId: "a1", status: "pending" },
    { alertId: "a2", status: "rejected" }
  ];
  assert.equal(buildFalsePositiveInsight(alert, suggestions).summary, "Este aviso teve 2 sugestão(ões) recusada(s).");
  assert.equal(buildFalsePositiveInsight({ id: "a2" }, suggestions), null);

  assert.equal(buildCapacityForecast({ type: "network_high" }).available, false);
  assert.equal(
    buildCapacityForecast({ type: "cpu_high", value: 50, threshold: 85 }).summary,
    "Sem dados suficientes para estimar esgotamento."
  );
  assert.deepEqual(buildCapacityForecast(alert), {
    available: true,
    summary: "Tendência exige acompanhamento preventivo antes de nova coleta real.",
    metric: "CPU",
    currentValue: 95,
    threshold: 85
  });

  const location = getAlertLocation(
    alert,
    new Map([["as1", { segmentId: "s1", segmentName: "Seg", segmentGroupId: "g1" }]]),
    new Map([["g1", { id: "g1", name: "Grupo" }]])
  );
  assert.deepEqual(location, { groupId: "g1", groupName: "Grupo", segmentId: "s1", segmentName: "Seg" });
  assert.deepEqual(getAlertLocation({ assetId: "x" }), {
    groupId: null,
    groupName: "Sem grupo",
    segmentId: null,
    segmentName: "Não organizadas"
  });

  const payload = buildSuggestionPayload(
    { type: "disk_full", hostName: "SRV", occurrencesCount: 2, severity: "critical" },
    { suggestedPriority: "high" }
  );
  assert.equal(payload.title, "Disco crítico em SRV");
  assert.equal(payload.suggestedPriority, "high");
  assert.equal(payload.suggestedProblemTypeId, "disk_full");
  assert.equal(payload.occurrencesCount, 2);
  assert.match(payload.description, /2 ocorrência\(s\)/);
  assert.equal(buildSuggestionPayload({}, null).title, "Aviso recorrente em ativo monitorado");
});

test("aviso e sugestao enriquecidos; correlacoes e resumo de insights", () => {
  const context = { serviceOrders: [], suggestions: [], segmentMap: new Map(), groupMap: new Map() };
  const alerts = [
    {
      id: "a1",
      type: "cpu_high",
      hostName: "H1",
      severity: "critical",
      occurrencesCount: 1,
      value: 90,
      threshold: 85,
      lastSeenAt: "2026-01-01"
    },
    {
      id: "a2",
      type: "cpu_high",
      hostName: "H2",
      severity: "high",
      occurrencesCount: 5,
      value: 90,
      threshold: 85,
      lastSeenAt: "2026-01-02"
    },
    { id: "a3", type: "disk_full", hostName: "H3", severity: "high", occurrencesCount: 1 }
  ].map((alert) => buildEnrichedAlert(alert, context, alert.id === "a1" ? [{ id: "c" }] : []));
  assert.equal(alerts[0].recurrenceScore, 42);
  assert.equal(alerts[1].recurrenceScore, 100);
  assert.equal(alerts[0].commentCount, 1);
  assert.equal(alerts[0].location.groupName, "Sem grupo");

  const correlations = buildAlertCorrelations(alerts);
  assert.equal(correlations.length, 1);
  assert.equal(correlations[0].correlationKey, "cpu_high:Sem grupo:Não organizadas");
  assert.equal(correlations[0].impactLevel, "critical");
  assert.equal(correlations[0].confidenceLevel, "Alta");
  assert.deepEqual(correlations[0].relatedHosts, ["H1", "H2"]);
  assert.equal(correlations[0].updatedAt, "2026-01-01");

  const insights = buildAlertInsights(alerts);
  assert.deepEqual(insights.recurrences, []);
  assert.deepEqual(insights.falsePositives, []);
  assert.equal(insights.capacity.length, 3);

  const suggestion = {
    id: "s1",
    alertId: "ghost",
    suggestedPriority: "",
    occurrencesCount: 2,
    alertType: "ram_high",
    createdAt: "2026-01-01"
  };
  const enriched = buildEnrichedSuggestion(suggestion, undefined, context);
  assert.equal(enriched.typeLabel, "Memória RAM acima do limite");
  assert.equal(enriched.recurrenceScore, 44);
  assert.equal(enriched.alertSeverity, "warning");
  assert.equal(enriched.suggestedPriority, "low");
  assert.equal(enriched.priorityLabel, "Baixa");
  assert.deepEqual(enriched.capacityForecast, { available: false, summary: "Sem dados históricos suficientes para previsão." });
  const withAlert = buildEnrichedSuggestion({ ...suggestion, suggestedPriority: "high" }, alerts[0], context);
  assert.equal(withAlert.typeLabel, "CPU acima do limite");
  assert.equal(withAlert.alertSeverity, "critical");
  assert.equal(withAlert.priorityLabel, "Alta");
});

test("avisos do agente: limite de offline vem do parametro, nao do ambiente", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");
  const asset = {
    id: "a",
    hostname: "H",
    lastSeenAt: "2026-07-29T11:55:00.000Z",
    intervalSeconds: 60,
    cpuUsagePercent: 10,
    memoryUsedBytes: 1,
    memoryTotalBytes: 10,
    diskFreeBytes: 9,
    diskTotalBytes: 10
  };
  assert.equal(buildAgentAlerts(asset, now).length, 0, "5 minutos < padrao de 10 minutos");
  const offline = buildAgentAlerts(asset, now, { offlineAfterMinutesSetting: 2 });
  assert.equal(offline.length, 1);
  assert.equal(offline[0].type, "machine_offline");
  assert.equal(offline[0].threshold, 180, "minimo de 3x o intervalo de coleta");
  assert.equal(buildAgentAlerts(asset, now, { offlineAfterSecondsSetting: 1000, offlineAfterMinutesSetting: 1 }).length, 0);
});
