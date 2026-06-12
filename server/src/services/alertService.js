import { addLog } from "../repositories/logRepository.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import {
  attachAcknowledgements,
  deleteAcknowledgement,
  findAcknowledgement,
  listAcknowledgements,
  upsertAcknowledgement
} from "../repositories/alertAcknowledgementRepository.js";
import {
  addAlertComment,
  createSuggestionForAlert,
  findAlertById,
  findServiceOrderSuggestionById,
  getAlertSettings,
  listAlertRules,
  listAlerts,
  listAlertComments,
  listServiceOrderSuggestions as listSuggestions,
  markSuggestionAccepted,
  markSuggestionRejected,
  updatePendingSuggestionPrioritiesForAlertType,
  updateAlertSettings,
  updateAlertRule,
  upsertAlert
} from "../repositories/alertRepository.js";
import {
  addServiceOrderHistory,
  createServiceOrder,
  findServiceOrderById,
  listServiceOrders
} from "../repositories/serviceOrderRepository.js";
import { listDeviceSegmentMap } from "../repositories/segmentRepository.js";
import { listSegmentGroups } from "../repositories/segmentGroupRepository.js";
import { getActiveAlerts, getAlertHistory, getHostAlerts } from "./zabbixService.js";

const alertTypeLabels = {
  ram_high: "Memória RAM acima do limite",
  cpu_high: "CPU acima do limite",
  disk_high: "Disco acima do limite",
  disk_health_low: "Saúde do disco abaixo do limite",
  machine_offline: "Máquina offline",
  network_high: "Alto uso de rede",
  temperature_high: "Temperatura alta",
  ping_failure: "Falha recorrente em ping",
  service_unavailable: "Serviço crítico indisponível"
};

const alertCategoryByType = {
  ram_high: "Desempenho",
  cpu_high: "Desempenho",
  disk_high: "Armazenamento",
  disk_health_low: "Armazenamento",
  machine_offline: "Disponibilidade",
  network_high: "Segurança",
  temperature_high: "Ambiente físico",
  ping_failure: "Disponibilidade",
  service_unavailable: "Disponibilidade"
};

const alertOperationalImpact = {
  ram_high: "Pode causar lentidão, travamentos e perda de produtividade.",
  cpu_high: "Pode degradar o desempenho e deixar aplicações sem resposta.",
  disk_high: "Pode impedir gravações, atualizações e funcionamento de serviços.",
  disk_health_low: "Pode indicar risco de falha física e perda de dados.",
  machine_offline: "Pode deixar usuário, setor ou serviço sem acesso ao equipamento.",
  network_high: "Pode indicar saturação, instabilidade ou tráfego incomum.",
  temperature_high: "Pode reduzir vida útil do equipamento e gerar desligamento inesperado.",
  ping_failure: "Pode indicar instabilidade de rede ou equipamento intermitente.",
  service_unavailable: "Pode interromper uma função crítica dependente do serviço."
};

const alertProbableCause = {
  ram_high: "Aplicação com alto consumo, carga acima do normal ou vazamento de memória.",
  cpu_high: "Processo travado, atualização em execução ou uso excessivo de processamento.",
  disk_high: "Logs, arquivos temporários, backup local ou armazenamento insuficiente.",
  disk_health_low: "Desgaste do disco, setores instáveis ou falha iminente.",
  machine_offline: "Equipamento desligado, cabo desconectado, queda de rede ou IP indisponível.",
  network_high: "Backup, cópia de arquivos, atualização ou tráfego inesperado.",
  temperature_high: "Poeira, ventilação obstruída ou temperatura ambiente elevada.",
  ping_failure: "Oscilação de rede, conflito de IP ou equipamento instável.",
  service_unavailable: "Serviço parado, dependência indisponível ou erro de configuração."
};

const alertRecommendedAction = {
  ram_high: "Verificar processos com maior consumo e avaliar reinício controlado ou expansão de memória.",
  cpu_high: "Identificar processo com alto consumo e validar se há tarefa travada.",
  disk_high: "Liberar espaço, revisar logs e avaliar limpeza preventiva.",
  disk_health_low: "Priorizar backup dos dados e avaliar troca preventiva do disco.",
  machine_offline: "Confirmar energia, rede e disponibilidade do equipamento antes de abrir atendimento.",
  network_high: "Validar tráfego incomum, portas ativas e uso de banda no segmento.",
  temperature_high: "Verificar ventilação, limpeza física e temperatura do ambiente.",
  ping_failure: "Validar cabo, Wi-Fi, switch e estabilidade do endereço IP.",
  service_unavailable: "Verificar serviço, dependências e logs antes de acionar manutenção."
};

const alertChecklist = {
  ram_high: [
    "Verificar processos com maior consumo.",
    "Conferir inicialização e serviços em segundo plano.",
    "Investigar malware ou aplicação travada.",
    "Avaliar upgrade de memória se recorrente."
  ],
  cpu_high: [
    "Identificar processo com alto consumo.",
    "Verificar atualizações em execução.",
    "Conferir serviços travados.",
    "Registrar evidências antes de reiniciar."
  ],
  disk_high: [
    "Verificar arquivos temporários.",
    "Conferir logs acumulados.",
    "Validar backups locais.",
    "Avaliar expansão ou limpeza de disco."
  ],
  disk_health_low: [
    "Realizar backup dos dados críticos.",
    "Conferir saúde do disco.",
    "Registrar evidências do alerta.",
    "Planejar troca preventiva."
  ],
  machine_offline: [
    "Verificar energia.",
    "Verificar cabo de rede ou Wi-Fi.",
    "Conferir porta do switch.",
    "Validar IP e manutenção programada."
  ],
  network_high: [
    "Identificar origem do tráfego.",
    "Validar backup ou cópia em andamento.",
    "Conferir portas e equipamentos do segmento.",
    "Registrar horário e impacto."
  ],
  temperature_high: [
    "Verificar ventilação.",
    "Limpar poeira e obstruções.",
    "Conferir temperatura ambiente.",
    "Avaliar manutenção preventiva."
  ],
  ping_failure: [
    "Verificar conectividade física.",
    "Testar rota de rede.",
    "Conferir conflito de IP.",
    "Validar estabilidade do equipamento."
  ],
  service_unavailable: [
    "Verificar se o serviço está parado.",
    "Conferir dependências.",
    "Analisar logs do serviço.",
    "Registrar impacto ao usuário."
  ]
};

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function classifyAlert(alert = {}) {
  const text = normalizeText(`${alert.title || ""} ${alert.description || ""}`);

  if (text.includes("memory") || text.includes("memoria") || text.includes("ram")) {
    return { type: "ram_high", metric: "ram", threshold: 90, value: 94 };
  }
  if (text.includes("cpu")) {
    return { type: "cpu_high", metric: "cpu", threshold: 90, value: 92 };
  }
  if (text.includes("disk") || text.includes("disco") || text.includes("storage") || text.includes("armazenamento")) {
    return { type: "disk_high", metric: "disk", threshold: 90, value: 94 };
  }
  if (text.includes("health") || text.includes("saude")) {
    return { type: "disk_health_low", metric: "disk_health", threshold: 80, value: 72 };
  }
  if (text.includes("ping")) {
    return { type: "ping_failure", metric: "ping", threshold: 0, value: 0 };
  }
  if (text.includes("network") || text.includes("rede")) {
    return { type: "network_high", metric: "network", threshold: 85, value: 88 };
  }
  if (text.includes("temperature") || text.includes("temperatura")) {
    return { type: "temperature_high", metric: "temperature", threshold: 80, value: 84 };
  }
  if (text.includes("service") || text.includes("servico")) {
    return { type: "service_unavailable", metric: "service", threshold: 0, value: 0 };
  }

  return { type: "machine_offline", metric: "availability", threshold: 0, value: 0 };
}

function simulatedOccurrences(alert = {}, type) {
  if (alert.status === "resolved") return 1;
  if (alert.severity === "critical") return 3;
  if (type === "ram_high" || type === "disk_high" || type === "machine_offline") return 3;
  return 2;
}

function suggestedPriority(alert = {}, rule = null) {
  if (rule?.suggestedPriority) return rule.suggestedPriority;
  if (alert.type === "disk_health_low" || alert.severity === "critical") return "critical";
  if (["ram_high", "cpu_high", "disk_high", "machine_offline", "ping_failure"].includes(alert.type)) return "high";
  return alert.severity === "warning" ? "medium" : "low";
}

function getAlertTypeLabel(alert = {}) {
  const type = alert.type || alert.alertType || alert.suggestedProblemTypeId;
  return alertTypeLabels[type] || alert.title || "Aviso de monitoramento";
}

function getAlertCategory(alert = {}) {
  const type = alert.type || alert.alertType || alert.suggestedProblemTypeId;
  return alertCategoryByType[type] || "Operacional";
}

function getAlertImpact(alert = {}) {
  const type = alert.type || alert.alertType || alert.suggestedProblemTypeId;
  return alertOperationalImpact[type] || "Pode gerar impacto operacional se o aviso se repetir.";
}

function getAlertProbableCause(alert = {}) {
  const type = alert.type || alert.alertType || alert.suggestedProblemTypeId;
  return alertProbableCause[type] || "Causa ainda não determinada com os dados disponíveis.";
}

function getAlertRecommendedAction(alert = {}) {
  const type = alert.type || alert.alertType || alert.suggestedProblemTypeId;
  return alertRecommendedAction[type] || "Registrar evidências e validar o ativo antes de abrir atendimento.";
}

function getAlertChecklist(alert = {}) {
  const type = alert.type || alert.alertType || alert.suggestedProblemTypeId;
  return alertChecklist[type] || [
    "Validar o ativo afetado.",
    "Conferir se o aviso se repetiu no período.",
    "Registrar evidências.",
    "Abrir OS somente se houver impacto confirmado."
  ];
}

function getAlertConfidence(alert = {}) {
  const occurrences = Number(alert.occurrencesCount || 1);
  if (alert.severity === "critical" && occurrences >= 3) return "Alta";
  if (occurrences >= 3) return "Média";
  return "Baixa";
}

function getAlertTrend(alert = {}) {
  const occurrences = Number(alert.occurrencesCount || 1);
  if (occurrences >= 4) return "Em alta";
  if (occurrences >= 2) return "Recorrente";
  return "Pontual";
}

function getPriorityLabel(priority) {
  const labels = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    critical: "Crítica"
  };
  return labels[priority] || labels.medium;
}

function formatDate(value) {
  if (!value) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function sameAsset(alert = {}, order = {}) {
  const alertIds = [alert.assetId, alert.hostId, alert.hostName].filter(Boolean).map(String);
  const orderIds = [order.assetId, order.relatedAssetText].filter(Boolean).map(String);
  return alertIds.some((id) => orderIds.includes(id));
}

function findRelatedOrders(alert = {}, serviceOrders = []) {
  return serviceOrders.filter((order) => {
    if (!sameAsset(alert, order)) return false;
    const orderProblem = normalizeText(`${order.problemType || ""} ${order.category || ""} ${order.description || ""}`);
    const alertProblem = normalizeText(`${alert.type || ""} ${alert.metric || ""} ${alert.title || ""}`);
    return orderProblem.includes(normalizeText(alert.type || "")) || alertProblem.includes(orderProblem.split(" ")[0] || "");
  });
}

function buildPriorityReason(alert = {}, relatedOrders = []) {
  const pieces = [];
  const occurrences = Number(alert.occurrencesCount || 1);

  if (alert.severity === "critical") pieces.push("o aviso está classificado como crítico");
  if (occurrences >= 3) pieces.push(`houve ${occurrences} ocorrências no período configurado`);
  if (["disk_health_low", "disk_high", "machine_offline", "service_unavailable"].includes(alert.type)) {
    pieces.push(`o tipo "${getAlertTypeLabel(alert)}" tem impacto operacional alto`);
  }
  if (relatedOrders.some((order) => order.status !== "closed" && !order.closedAt)) {
    pieces.push("já existe OS aberta relacionada ao mesmo ativo");
  }
  if (relatedOrders.some((order) => order.closedAt)) {
    pieces.push("há histórico recente de atendimento para o mesmo ativo");
  }

  if (!pieces.length) {
    pieces.push("o aviso ainda tem baixa recorrência e precisa de validação manual");
  }

  return `Prioridade sugerida porque ${pieces.join(", ")}.`;
}

function buildRecurrenceInsight(alert = {}, relatedOrders = []) {
  const recentClosed = relatedOrders
    .filter((order) => order.closedAt)
    .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())[0];

  if (!recentClosed) return null;

  const closedAt = new Date(recentClosed.closedAt).getTime();
  const alertAt = new Date(alert.lastSeenAt || alert.updatedAt || Date.now()).getTime();
  const days = Math.max(0, Math.round((alertAt - closedAt) / 86400000));

  if (days > 14) return null;

  return {
    type: "post_service_order_recurrence",
    summary: `Aviso voltou ${days || 1} dia(s) após a OS ${recentClosed.number || recentClosed.id}.`,
    serviceOrderId: recentClosed.id,
    serviceOrderNumber: recentClosed.number,
    qualityHint: "Revisar se a correção aplicada resolveu a causa raiz ou apenas o sintoma."
  };
}

function buildFalsePositiveInsight(alert = {}, suggestions = []) {
  const rejectedCount = suggestions.filter((suggestion) =>
    suggestion.alertId === alert.id && suggestion.status === "rejected"
  ).length;

  if (rejectedCount < 2) return null;

  return {
    type: "possible_false_positive",
    summary: `Este aviso teve ${rejectedCount} sugestão(ões) recusada(s).`,
    recommendation: "Avaliar ajuste de limite, janela de recorrência ou regra de sugestão."
  };
}

function buildCapacityForecast(alert = {}) {
  if (!["disk_high", "ram_high", "cpu_high"].includes(alert.type)) {
    return {
      available: false,
      summary: "Sem dados históricos suficientes para previsão de capacidade."
    };
  }

  const value = Number(alert.value || 0);
  const threshold = Number(alert.threshold || 0);
  if (!value || !threshold || value < threshold) {
    return {
      available: false,
      summary: "Sem dados suficientes para estimar esgotamento."
    };
  }

  return {
    available: true,
    summary: "Tendência exige acompanhamento preventivo antes de nova coleta real.",
    metric: alert.metric,
    currentValue: value,
    threshold
  };
}

function getAlertLocation(alert = {}, segmentMap = new Map(), groupMap = new Map()) {
  const segment = alert.assetId ? segmentMap.get(String(alert.assetId)) : null;
  const group = segment?.segmentGroupId ? groupMap.get(String(segment.segmentGroupId)) : null;

  return {
    groupId: group?.id || null,
    groupName: group?.name || "Sem grupo",
    segmentId: segment?.segmentId || null,
    segmentName: segment?.segmentName || "Não organizadas"
  };
}

async function buildAlertEnrichmentContext() {
  const [serviceOrders, suggestions, segmentMap, groups] = await Promise.all([
    listServiceOrders(),
    listSuggestions(),
    listDeviceSegmentMap(),
    listSegmentGroups()
  ]);

  return {
    serviceOrders,
    suggestions,
    segmentMap,
    groupMap: new Map(groups.map((group) => [String(group.id), group]))
  };
}

async function enrichAlerts(alerts = [], context = null) {
  const nextContext = context || await buildAlertEnrichmentContext();
  const commentsByAlert = new Map();

  await Promise.all(alerts.map(async (alert) => {
    commentsByAlert.set(alert.id, await listAlertComments(alert.id));
  }));

  return alerts.map((alert) => {
    const relatedOrders = findRelatedOrders(alert, nextContext.serviceOrders);
    const location = getAlertLocation(alert, nextContext.segmentMap, nextContext.groupMap);
    const comments = commentsByAlert.get(alert.id) || [];

    return {
      ...alert,
      typeLabel: getAlertTypeLabel(alert),
      category: getAlertCategory(alert),
      operationalImpact: getAlertImpact(alert),
      probableCause: getAlertProbableCause(alert),
      recommendedAction: getAlertRecommendedAction(alert),
      checklist: getAlertChecklist(alert),
      confidenceLevel: getAlertConfidence(alert),
      trend: getAlertTrend(alert),
      priorityReason: buildPriorityReason(alert, relatedOrders),
      recurrenceScore: Math.min(100, Math.max(10, (Number(alert.occurrencesCount || 1) * 22) + (alert.severity === "critical" ? 20 : 0))),
      capacityForecast: buildCapacityForecast(alert),
      recurrenceInsight: buildRecurrenceInsight(alert, relatedOrders),
      falsePositiveInsight: buildFalsePositiveInsight(alert, nextContext.suggestions),
      location,
      relatedServiceOrders: relatedOrders.slice(0, 3).map((order) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        priority: order.priority,
        closedAt: order.closedAt
      })),
      comments,
      commentCount: comments.length
    };
  });
}

function buildCorrelationKey(alert = {}, location = {}) {
  return [
    alert.type || "unknown",
    location.groupId || location.groupName || "ungrouped",
    location.segmentId || location.segmentName || "unorganized"
  ].join(":");
}

function buildSuggestionPayload(alert = {}, rule = null) {
  const label = alertTypeLabels[alert.type] || "Aviso recorrente";
  const hostName = alert.hostName || "ativo monitorado";
  const priority = suggestedPriority(alert, rule);

  return {
    title: `Verificação preventiva: ${label.toLowerCase()} em ${hostName}`,
    description:
      `O sistema identificou ${label.toLowerCase()} acima do limite configurado em ` +
      `${alert.occurrencesCount || 1} ocorrência(s) no período analisado. ` +
      "Recomenda-se análise preventiva do ativo antes de impacto operacional.",
    suggestedPriority: priority,
    suggestedProblemTypeId: alert.type,
    occurrencesCount: alert.occurrencesCount || 1
  };
}

function normalizeMonitoringAlert(alert = {}) {
  const classification = classifyAlert(alert);
  const occurrencesCount = simulatedOccurrences(alert, classification.type);
  return {
    id: alert.id,
    assetId: alert.hostId,
    hostId: alert.hostId,
    hostName: alert.hostName,
    type: classification.type,
    metric: classification.metric,
    title: alertTypeLabels[classification.type] || alert.title || "Aviso de monitoramento",
    description: alert.description || "",
    severity: alert.severity || "warning",
    value: classification.value,
    threshold: classification.threshold,
    status: alert.status || "active",
    firstSeenAt: alert.startedAt || new Date().toISOString(),
    lastSeenAt: alert.resolvedAt || alert.startedAt || new Date().toISOString(),
    resolvedAt: alert.resolvedAt || null,
    occurrencesCount,
    source: "mock"
  };
}

async function syncMockAlerts() {
  const mockAlerts = await getAlertHistory();
  for (const alert of mockAlerts.map(normalizeMonitoringAlert)) {
    await upsertAlert(alert);
  }
}

async function attachCurrentAcknowledgements(alerts) {
  const acknowledgements = await listAcknowledgements();
  return attachAcknowledgements(alerts, acknowledgements);
}

export async function getActiveAlertsWithAcknowledgements() {
  await syncMockAlerts();
  const alerts = await listAlerts({ status: "active" });
  return enrichAlerts(await attachCurrentAcknowledgements(alerts));
}

export async function getAlertHistoryWithAcknowledgements() {
  await syncMockAlerts();
  const alerts = await listAlerts();
  return enrichAlerts(await attachCurrentAcknowledgements(alerts));
}

export async function getHostAlertsWithAcknowledgements(hostId) {
  await syncMockAlerts();
  const alerts = (await listAlerts()).filter((alert) => alert.hostId === hostId || alert.assetId === hostId);
  return enrichAlerts(await attachCurrentAcknowledgements(alerts));
}

export async function getAlertRules() {
  return listAlertRules();
}

export async function getAlertSettingsData() {
  return getAlertSettings();
}

export async function updateAlertSettingsData({ payload, user }) {
  const settings = await updateAlertSettings(payload);
  await addLog({
    type: "alert_settings_update",
    message: "Configurações de prioridade dos avisos atualizadas.",
    userId: user?.id,
    meta: { keys: Object.keys(payload || {}) }
  });
  return settings;
}

export async function updateAlertRuleById({ id, payload, user }) {
  const rule = await updateAlertRule(id, payload);
  if (Object.prototype.hasOwnProperty.call(payload || {}, "suggestedPriority")) {
    await updatePendingSuggestionPrioritiesForAlertType(rule.type, rule.suggestedPriority);
  }
  await addLog({
    type: "alert_rule_update",
    message: `Regra de aviso atualizada: ${rule.type}`,
    userId: user?.id,
    meta: { ruleId: rule.id, type: rule.type }
  });
  return rule;
}

export async function evaluateAlertsForSuggestions(user = null) {
  await syncMockAlerts();
  const [alerts, rules] = await Promise.all([listAlerts({ status: "active" }), listAlertRules()]);
  const enabledRules = new Map(rules.filter((rule) => rule.enabled).map((rule) => [rule.type, rule]));
  const createdSuggestions = [];

  for (const alert of alerts) {
    const rule = enabledRules.get(alert.type) || null;

    const result = await createSuggestionForAlert(alert, buildSuggestionPayload(alert, rule));
    if (result.created && result.suggestion) {
      createdSuggestions.push(result.suggestion);
      if (alert.assetId) {
        await addAssetHistory({
          assetId: alert.assetId,
          eventType: "alert_suggestion_created",
          message: `Sugestão de OS criada por aviso recorrente: ${alert.title}.`,
          newValue: result.suggestion.title,
          userId: user?.id || null,
          userName: user?.name || "Sistema"
        });
      }
    }
  }

  return {
    alerts: await enrichAlerts(alerts),
    rules,
    suggestions: await enrichSuggestions(await listSuggestions()),
    createdSuggestions
  };
}

async function enrichSuggestions(suggestions = []) {
  const context = await buildAlertEnrichmentContext();
  const alertIds = [...new Set(suggestions.map((suggestion) => suggestion.alertId).filter(Boolean))];
  const alerts = await Promise.all(alertIds.map((id) => findAlertById(id)));
  const alertMap = new Map(alerts.filter(Boolean).map((alert) => [alert.id, alert]));
  const enrichedAlerts = await enrichAlerts(alerts.filter(Boolean), context);
  const enrichedAlertMap = new Map(enrichedAlerts.map((alert) => [alert.id, alert]));

  return suggestions.map((suggestion) => {
    const alert = enrichedAlertMap.get(suggestion.alertId) || alertMap.get(suggestion.alertId);
    const relatedOrders = alert ? findRelatedOrders(alert, context.serviceOrders) : [];
    const priority = suggestion.suggestedPriority || suggestedPriority(alert);

    return {
      ...suggestion,
      suggestedPriority: priority,
      priorityLabel: getPriorityLabel(priority),
      priorityReason: alert?.priorityReason || buildPriorityReason(alert || suggestion, relatedOrders),
      typeLabel: alert?.typeLabel || alertTypeLabels[suggestion.alertType] || "Aviso preventivo",
      category: alert?.category || getAlertCategory(alert || suggestion),
      operationalImpact: alert?.operationalImpact || getAlertImpact(alert || suggestion),
      probableCause: alert?.probableCause || getAlertProbableCause(alert || suggestion),
      recommendedAction: alert?.recommendedAction || getAlertRecommendedAction(alert || suggestion),
      checklist: alert?.checklist || getAlertChecklist(alert || suggestion),
      recurrenceScore: alert?.recurrenceScore || Math.min(100, Number(suggestion.occurrencesCount || 1) * 22),
      recurrenceInsight: alert?.recurrenceInsight || null,
      falsePositiveInsight: alert?.falsePositiveInsight || null,
      capacityForecast: alert?.capacityForecast || { available: false, summary: "Sem dados históricos suficientes para previsão." },
      location: alert?.location || getAlertLocation(alert || suggestion, context.segmentMap, context.groupMap),
      relatedServiceOrders: alert?.relatedServiceOrders || [],
      comments: alert?.comments || [],
      commentCount: alert?.commentCount || 0,
      alertFirstSeenAt: alert?.firstSeenAt || suggestion.alertFirstSeenAt || suggestion.createdAt,
      alertLastSeenAt: alert?.lastSeenAt || suggestion.alertLastSeenAt || suggestion.updatedAt || suggestion.createdAt,
      alertSeverity: alert?.severity || suggestion.alertSeverity || "warning"
    };
  });
}

export async function listServiceOrderSuggestions() {
  await evaluateAlertsForSuggestions();
  return enrichSuggestions(await listSuggestions());
}

export async function getAlertCorrelations() {
  await syncMockAlerts();
  const context = await buildAlertEnrichmentContext();
  const alerts = await enrichAlerts(await listAlerts({ status: "active" }), context);
  const groups = new Map();

  for (const alert of alerts) {
    const key = buildCorrelationKey(alert, alert.location);
    const current = groups.get(key) || [];
    current.push(alert);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .filter(([, items]) => items.length >= 2)
    .map(([key, items]) => {
      const first = items[0];
      const criticalCount = items.filter((alert) => alert.severity === "critical").length;

      return {
        id: `corr-${key}`,
        correlationId: `corr-${key}`,
        correlationGroup: first.location?.groupName || "Sem grupo",
        correlationKey: key,
        correlationSummary:
          `${items.length} aviso(s) de ${first.typeLabel || getAlertTypeLabel(first)} em ` +
          `${first.location?.groupName || "Sem grupo"} / ${first.location?.segmentName || "Não organizadas"}.`,
        impactLevel: criticalCount ? "critical" : "warning",
        confidenceLevel: items.length >= 3 || criticalCount ? "Alta" : "Média",
        relatedAlerts: items.map((alert) => ({
          id: alert.id,
          title: alert.title,
          hostName: alert.hostName,
          severity: alert.severity,
          value: alert.value,
          threshold: alert.threshold,
          lastSeenAt: alert.lastSeenAt
        })),
        relatedHosts: [...new Set(items.map((alert) => alert.hostName || alert.assetId).filter(Boolean))],
        updatedAt: items[0]?.lastSeenAt || items[0]?.updatedAt || new Date().toISOString()
      };
    });
}

export async function getAlertInsights() {
  await syncMockAlerts();
  const alerts = await enrichAlerts(await listAlerts({ status: "active" }));
  return {
    recurrences: alerts.filter((alert) => alert.recurrenceInsight).map((alert) => ({
      alertId: alert.id,
      hostName: alert.hostName,
      ...alert.recurrenceInsight
    })),
    falsePositives: alerts.filter((alert) => alert.falsePositiveInsight).map((alert) => ({
      alertId: alert.id,
      hostName: alert.hostName,
      ...alert.falsePositiveInsight
    })),
    capacity: alerts.map((alert) => ({
      alertId: alert.id,
      hostName: alert.hostName,
      forecast: alert.capacityForecast
    }))
  };
}

export async function listCommentsForAlert(alertId) {
  const alert = await findAlertById(alertId);
  if (!alert) {
    const error = new Error("Aviso não encontrado.");
    error.statusCode = 404;
    throw error;
  }

  return listAlertComments(alertId);
}

export async function addCommentToAlert({ alertId, message, user }) {
  const alert = await findAlertById(alertId);
  if (!alert) {
    const error = new Error("Aviso não encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const comment = await addAlertComment({
    alertId,
    message,
    userId: user?.id || null
  });

  await addLog({
    type: "alert_comment_created",
    message: `Comentário registrado no aviso: ${alert.title}`,
    userId: user?.id,
    meta: { alertId }
  });

  return {
    ...comment,
    userName: user?.name || comment.userName
  };
}

export async function acceptServiceOrderSuggestion({ id, user }) {
  const suggestion = await findServiceOrderSuggestionById(id);
  if (!suggestion) {
    const error = new Error("Sugestão de OS não encontrada.");
    error.statusCode = 404;
    throw error;
  }
  if (suggestion.status === "accepted" && suggestion.createdServiceOrderId) {
    const serviceOrder = await findServiceOrderById(suggestion.createdServiceOrderId, user);
    return { suggestion, serviceOrder };
  }
  if (suggestion.status !== "pending") {
    const error = new Error("Apenas sugestões pendentes podem ser aceitas.");
    error.statusCode = 409;
    throw error;
  }

  const alert = await findAlertById(suggestion.alertId);
  const serviceOrder = await createServiceOrder({
    payload: {
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.suggestedPriority,
      category: "Monitoramento",
      problemType: alert?.type || suggestion.suggestedProblemTypeId || "alerta",
      assetId: suggestion.assetId || alert?.assetId || null,
      relatedAssetText: alert?.hostName || null,
      source: "alert_suggestion",
      notes: `Origem: aviso/sugestão de OS. Tipo: ${alert?.title || suggestion.title}.`
    },
    user
  });

  await addServiceOrderHistory({
    serviceOrderId: serviceOrder.id,
    eventType: "alert_suggestion_accepted",
    message:
      `OS criada a partir de sugestão de aviso. Tipo: ${alert?.title || "Aviso"}. ` +
      `Métrica: ${alert?.metric || "monitoramento"}. Ocorrências: ${suggestion.occurrencesCount}.`,
    newValue: suggestion.id,
    user
  });

  if (suggestion.assetId || alert?.assetId) {
    await addAssetHistory({
      assetId: suggestion.assetId || alert.assetId,
      eventType: "alert_suggestion_accepted",
      message: `${user?.name || "Usuário"} aceitou sugestão de OS gerada por ${alert?.title || "aviso recorrente"}.`,
      newValue: serviceOrder.number,
      userId: user?.id || null,
      userName: user?.name || null
    });
  }

  const updatedSuggestion = await markSuggestionAccepted({
    id: suggestion.id,
    userId: user?.id,
    serviceOrderId: serviceOrder.id
  });

  await addLog({
    type: "alert_suggestion_accepted",
    message: `Sugestão de OS aceita: ${serviceOrder.number}`,
    userId: user?.id,
    meta: { suggestionId: suggestion.id, alertId: suggestion.alertId, serviceOrderId: serviceOrder.id }
  });

  return { suggestion: updatedSuggestion, serviceOrder };
}

export async function rejectServiceOrderSuggestion({ id, reason, user }) {
  const suggestion = await findServiceOrderSuggestionById(id);
  if (!suggestion) {
    const error = new Error("Sugestão de OS não encontrada.");
    error.statusCode = 404;
    throw error;
  }
  if (suggestion.status !== "pending") {
    const error = new Error("Apenas sugestões pendentes podem ser recusadas.");
    error.statusCode = 409;
    throw error;
  }

  const settings = await getAlertSettings();
  const silenceHours = Math.max(1, Number(settings.rejectedAlertSilenceHours || 24));
  const updatedSuggestion = await markSuggestionRejected({
    id,
    userId: user?.id,
    reason,
    silenceHours
  });
  const alert = await findAlertById(suggestion.alertId);

  if (suggestion.assetId || alert?.assetId) {
    await addAssetHistory({
      assetId: suggestion.assetId || alert.assetId,
      eventType: "alert_suggestion_rejected",
      message:
        `${user?.name || "Usuário"} recusou sugestão de OS gerada por ${alert?.title || "aviso recorrente"}. ` +
        `Aviso ignorado por ${silenceHours} hora(s).`,
      oldValue: suggestion.title,
      newValue: reason || null,
      userId: user?.id || null,
      userName: user?.name || null
    });
  }

  await addLog({
    type: "alert_suggestion_rejected",
    message: "Sugestão de OS recusada",
    userId: user?.id,
    meta: {
      suggestionId: suggestion.id,
      alertId: suggestion.alertId,
      reason: reason || null,
      silenceHours,
      ignoredUntil: updatedSuggestion?.ignoredUntil || null
    }
  });

  return updatedSuggestion;
}

export async function acknowledgeAlert({ alertId, user, note }) {
  const alerts = await getAlertHistory();
  const alert = alerts.find((item) => item.id === alertId);

  if (!alert) {
    const error = new Error("Alert not found");
    error.statusCode = 404;
    throw error;
  }

  const acknowledgement = await upsertAcknowledgement({ alertId, userId: user.id, note });

  await addLog({
    type: "alert_acknowledgement",
    message: `Alert acknowledged: ${alert.title}`,
    userId: user.id,
    meta: { alertId, hostId: alert.hostId, note: note || null }
  });

  return { ...alert, acknowledgement };
}

export async function unacknowledgeAlert({ alertId, user }) {
  const acknowledgement = await findAcknowledgement(alertId);

  if (!acknowledgement) {
    const error = new Error("Alert acknowledgement not found");
    error.statusCode = 404;
    throw error;
  }

  await deleteAcknowledgement(alertId);

  await addLog({
    type: "alert_unacknowledgement",
    message: "Alert acknowledgement removed",
    userId: user.id,
    meta: { alertId }
  });

  return { alertId };
}
