import {
  alertTypeLabels,
  compactAlertTypeLabels,
  getAlertCategory,
  getAlertChecklist,
  getAlertConfidence,
  getAlertImpact,
  getAlertProbableCause,
  getAlertRecommendedAction,
  getAlertTrend,
  getAlertTypeLabel,
  getPriorityLabel,
  normalizeText,
  suggestedPriority
} from "./alertCatalog.js";

function sameAsset(alert = {}, order = {}) {
  const alertIds = [alert.assetId, alert.hostId, alert.hostName].filter(Boolean).map(String);
  const orderIds = [order.assetId, order.relatedAssetText].filter(Boolean).map(String);
  return alertIds.some((id) => orderIds.includes(id));
}

export function findRelatedOrders(alert = {}, serviceOrders = []) {
  return serviceOrders.filter((order) => {
    if (!sameAsset(alert, order)) return false;
    const orderProblem = normalizeText(`${order.problemType || ""} ${order.category || ""} ${order.description || ""}`);
    const alertProblem = normalizeText(`${alert.type || ""} ${alert.metric || ""} ${alert.title || ""}`);
    return orderProblem.includes(normalizeText(alert.type || "")) || alertProblem.includes(orderProblem.split(" ")[0] || "");
  });
}

export function buildPriorityReason(alert = {}, relatedOrders = []) {
  const pieces = [];
  const occurrences = Number(alert.occurrencesCount || 1);

  if (alert.severity === "critical") pieces.push("o aviso está classificado como crítico");
  if (occurrences >= 3) pieces.push(`houve ${occurrences} ocorrências no período configurado`);
  if (["disk_health_low", "disk_high", "disk_full", "machine_offline", "service_unavailable"].includes(alert.type)) {
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

export function buildRecurrenceInsight(alert = {}, relatedOrders = []) {
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

export function buildFalsePositiveInsight(alert = {}, suggestions = []) {
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

export function buildCapacityForecast(alert = {}) {
  if (!["disk_high", "disk_full", "ram_high", "cpu_high"].includes(alert.type)) {
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

export function getAlertLocation(alert = {}, segmentMap = new Map(), groupMap = new Map()) {
  const segment = alert.assetId ? segmentMap.get(String(alert.assetId)) : null;
  const group = segment?.segmentGroupId ? groupMap.get(String(segment.segmentGroupId)) : null;

  return {
    groupId: group?.id || null,
    groupName: group?.name || "Sem grupo",
    segmentId: segment?.segmentId || null,
    segmentName: segment?.segmentName || "Não organizadas"
  };
}

export function buildCorrelationKey(alert = {}, location = {}) {
  return [
    alert.type || "unknown",
    location.groupId || location.groupName || "ungrouped",
    location.segmentId || location.segmentName || "unorganized"
  ].join(":");
}

export function buildSuggestionPayload(alert = {}, rule = null) {
  const label = alertTypeLabels[alert.type] || "Aviso recorrente";
  const hostName = alert.hostName || "ativo monitorado";
  const priority = suggestedPriority(alert, rule);

  return {
    title: `${compactAlertTypeLabels[alert.type] || label} em ${hostName}`,
    description:
      `O sistema identificou ${label.toLowerCase()} acima do limite configurado em ` +
      `${alert.occurrencesCount || 1} ocorrência(s) no período analisado. ` +
      "Recomenda-se análise preventiva do ativo antes de impacto operacional.",
    suggestedPriority: priority,
    suggestedProblemTypeId: alert.type,
    occurrencesCount: alert.occurrencesCount || 1
  };
}

/** Aviso enriquecido com classificacao, justificativas, insights, localizacao e comentarios. */
export function buildEnrichedAlert(alert, context, comments = []) {
  const relatedOrders = findRelatedOrders(alert, context.serviceOrders);
  const location = getAlertLocation(alert, context.segmentMap, context.groupMap);

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
    falsePositiveInsight: buildFalsePositiveInsight(alert, context.suggestions),
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
}

/** Sugestao de OS enriquecida; usa o aviso ja enriquecido quando existir e deduz o resto da propria sugestao. */
export function buildEnrichedSuggestion(suggestion, alert, context) {
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
}

/** Agrupa avisos enriquecidos por tipo e localizacao; so grupos com 2+ avisos viram correlacao. */
export function buildAlertCorrelations(alerts) {
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

/** Resumo de recorrencias, possiveis falsos positivos e previsao de capacidade dos avisos enriquecidos. */
export function buildAlertInsights(alerts) {
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
