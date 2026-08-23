import { calculateInfrastructureHealth } from "./infrastructureHealth.js";

const priorityLabels = { low: "Baixa", medium: "Media", high: "Alta", critical: "Critica" };
const deviceStatusLabels = { online: "Online", offline: "Offline", problem: "Erro", unknown: "Sem dados" };
const severityLabels = { critical: "Critica", high: "Alta", medium: "Media", low: "Baixa", warning: "Atencao" };
const slaStatusLabels = {
  not_applicable: "Nao se aplica",
  on_track: "No prazo",
  near_due: "Perto do vencimento",
  breached: "Vencida",
  resolved: "Concluida no prazo"
};
const originLabels = {
  preventive: "Preventiva",
  alert_suggestion: "Alerta",
  public_support_form: "Portal publico",
  manual: "Manual"
};
const connectionModeLabels = { webrtc: "Video (WebRTC)", snapshot_polling: "Capturas de tela" };
const remoteAssistanceStatusLabels = {
  requested: "Solicitada",
  waiting_consent: "Aguardando consentimento",
  active: "Ativa",
  ended: "Encerrada",
  failed: "Falhou",
  expired: "Expirada"
};

const RANKING_LIMIT = 5;

/**
 * Filtro por intervalo de data explicito (equivalente, para relatorios, ao
 * `withinPeriod` de dashboardService.js que so trabalha com janela
 * rolante). `startDate`/`endDate` sao strings ISO (so a parte de data);
 * ausentes = sem limite naquela ponta.
 */
export function inDateRange(value, startDate, endDate) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  if (startDate) {
    const start = Date.parse(`${startDate}T00:00:00.000Z`);
    if (Number.isFinite(start) && time < start) return false;
  }
  if (endDate) {
    const end = Date.parse(`${endDate}T23:59:59.999Z`);
    if (Number.isFinite(end) && time > end) return false;
  }
  return true;
}

function average(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return null;
  return Math.round(finite.reduce((sum, value) => sum + value, 0) / finite.length);
}

function averageMinutesBetween(items, startField, endField) {
  return average(
    items.map((item) => {
      const start = Date.parse(item[startField]);
      const end = Date.parse(item[endField]);
      return Number.isFinite(start) && Number.isFinite(end) && end >= start ? (end - start) / 60000 : NaN;
    })
  );
}

function minutesBetween(startAt, endAt) {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 60000);
}

function countBy(list, keyFn, labelFn = (key) => String(key)) {
  const counts = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (key == null || key === "") continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: labelFn(key), count }))
    .sort((a, b) => b.count - a.count);
}

function matchesSearchText(haystack, needle) {
  if (!needle) return true;
  return String(haystack || "").toLowerCase().includes(String(needle).toLowerCase());
}

/**
 * Versao duplicada, propositalmente, de `getServiceOrderOriginKey` de
 * client/src/components/serviceOrders/serviceOrderBoardUtils.js:158 - essa
 * funcao e client-only (sem dependencia de banco/React), entao mover para
 * `shared/` so por essas 4 linhas nao compensa. Testada separadamente para
 * garantir que as duas nunca divirjam.
 */
export function deriveServiceOrderOrigin(order = {}) {
  if (order.preventivePlanId) return "preventive";
  if (order.source === "alert_suggestion") return "alert_suggestion";
  if (order.source === "public_support_form") return "public_support_form";
  return "manual";
}

function buildDeviceMap(devices = []) {
  return new Map(devices.map((device) => [String(device.id), device]));
}

function deviceMetricPercent(device, key) {
  const value = device?.metrics?.[key];
  return Number.isFinite(value) ? value : null;
}

function rankAssetsByAlerts(alerts, deviceMap, limit = RANKING_LIMIT) {
  const totals = new Map();
  for (const alert of alerts) {
    const id = String(alert.hostId || alert.assetId || "");
    if (!id) continue;
    const current = totals.get(id) || { count: 0, occurrences: 0, hostName: alert.hostName };
    current.count += 1;
    current.occurrences += Number(alert.occurrencesCount || 1);
    totals.set(id, current);
  }
  return Array.from(totals.entries())
    .map(([assetId, data]) => {
      const device = deviceMap.get(assetId);
      return {
        assetId,
        name: device?.name || data.hostName || assetId,
        alertCount: data.count,
        occurrences: data.occurrences
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, limit);
}

// --- Mensal -----------------------------------------------------------

export function buildMonthlyReport({
  devices = [],
  alerts = [],
  serviceOrders = [],
  statusSettings,
  systemMode,
  startDate,
  endDate
} = {}) {
  const statusById = new Map((statusSettings?.statuses || []).map((status) => [status.id, status]));
  const isFinalStatus = (statusId) => statusById.get(statusId)?.isFinal ?? statusId === "closed";

  const ordersInRange = serviceOrders.filter((order) => inDateRange(order.createdAt, startDate, endDate));
  const closedInRange = serviceOrders.filter(
    (order) => order.closedAt && inDateRange(order.closedAt, startDate, endDate)
  );
  const avgResolutionMinutes = averageMinutesBetween(
    closedInRange.filter((order) => isFinalStatus(order.status)),
    "createdAt",
    "closedAt"
  );
  const avgFirstResponseMinutes = averageMinutesBetween(
    ordersInRange.filter((order) => order.firstResponseAt),
    "createdAt",
    "firstResponseAt"
  );

  const openOrders = serviceOrders.filter((order) => !isFinalStatus(order.status));
  let overdueCount = 0;
  let nearDueCount = 0;
  for (const order of openOrders) {
    const sla = order.sla;
    if (sla?.breached) overdueCount += 1;
    else if (sla?.nearDue) nearDueCount += 1;
  }

  const totalAssets = devices.length;
  const onlineAssets = devices.filter((device) => device.status === "online").length;
  const offlineAssets = devices.filter((device) => device.status === "offline").length;
  const criticalAssets = devices.filter((device) => device.status === "problem").length;

  const alertsInRange = alerts.filter((alert) => inDateRange(alert.firstSeenAt || alert.lastSeenAt, startDate, endDate));
  const criticalAlertsInRange = alertsInRange.filter((alert) => alert.severity === "critical").length;

  const criticalDiskAssets = devices.filter((device) => Number(device.metrics?.disk) >= 90).length;
  const criticalPerformanceAssets = devices.filter(
    (device) => Number(device.metrics?.cpu) >= 90 || Number(device.metrics?.ram) >= 90
  ).length;

  const infrastructureHealth = calculateInfrastructureHealth({
    totalAssets,
    offlineAssets,
    criticalAlerts: criticalAlertsInRange,
    overdueServiceOrders: overdueCount,
    criticalDiskAssets,
    criticalPerformanceAssets,
    staleHeartbeatAssets: criticalAssets,
    recurringProblemAssets: new Set(
      alertsInRange.filter((alert) => Number(alert.occurrencesCount || 1) >= 3).map((alert) => alert.hostId)
    ).size
  });

  const byEnvironment =
    systemMode === "business"
      ? countBy(
          ordersInRange.filter((order) => order.environmentName),
          (order) => order.environmentName
        ).slice(0, 10)
      : [];

  const summary = {
    period: { startDate: startDate || null, endDate: endDate || null },
    assets: { total: totalAssets, online: onlineAssets, offline: offlineAssets, withError: criticalAssets },
    serviceOrders: {
      createdInPeriod: ordersInRange.length,
      closedInPeriod: closedInRange.length,
      avgResolutionMinutes,
      avgFirstResponseMinutes,
      overdueNow: overdueCount,
      nearDueNow: nearDueCount
    },
    alerts: {
      inPeriod: alertsInRange.length,
      critical: criticalAlertsInRange,
      bySeverity: countBy(alertsInRange, (alert) => alert.severity, (id) => severityLabels[id] || id)
    },
    byEnvironment,
    infrastructureHealthNow: infrastructureHealth
  };

  const rows = [
    { metric: "Periodo", value: `${startDate || "inicio"} a ${endDate || "hoje"}` },
    { metric: "Ativos totais", value: totalAssets },
    { metric: "Ativos online", value: onlineAssets },
    { metric: "Ativos offline", value: offlineAssets },
    { metric: "Ativos com erro", value: criticalAssets },
    { metric: "OS criadas no periodo", value: ordersInRange.length },
    { metric: "OS fechadas no periodo", value: closedInRange.length },
    { metric: "Tempo medio de resolucao (min)", value: avgResolutionMinutes ?? "Indisponivel" },
    { metric: "Tempo medio de primeira resposta (min)", value: avgFirstResponseMinutes ?? "Indisponivel" },
    { metric: "OS vencidas (situacao atual)", value: overdueCount },
    { metric: "OS perto do vencimento (situacao atual)", value: nearDueCount },
    { metric: "Alertas no periodo", value: alertsInRange.length },
    { metric: "Alertas criticos no periodo", value: criticalAlertsInRange },
    { metric: "Saude atual da infraestrutura", value: infrastructureHealth?.score ?? "Indisponivel" }
  ];

  return {
    summary,
    rows,
    warnings: [
      "A saude da infraestrutura e uma metrica ao vivo (situacao atual), nao uma medicao historica do periodo selecionado."
    ]
  };
}

// --- Ordens de Servico --------------------------------------------------

export function buildServiceOrdersReport(
  { serviceOrders = [], deviceMap = new Map(), statusById = new Map() } = {},
  filters = {}
) {
  const { startDate, endDate, status, priority, origin, environmentName, technician, search } = filters;

  const filtered = serviceOrders.filter((order) => {
    if (!inDateRange(order.createdAt, startDate, endDate)) return false;
    if (status && order.status !== status) return false;
    if (priority && order.priority !== priority) return false;
    if (origin && deriveServiceOrderOrigin(order) !== origin) return false;
    if (environmentName && !matchesSearchText(order.environmentName, environmentName)) return false;
    if (technician && !matchesSearchText(order.assignedTechnicianName, technician)) return false;
    if (search && !matchesSearchText(order.title, search) && !matchesSearchText(order.number, search)) return false;
    return true;
  });

  const rows = filtered.map((order) => {
    const originKey = deriveServiceOrderOrigin(order);
    const asset = order.assetId ? deviceMap.get(String(order.assetId)) : null;
    return {
      id: order.id,
      number: order.number,
      title: order.title,
      status: order.status,
      statusLabel: statusById.get(order.status)?.name || order.status,
      priority: order.priority,
      priorityLabel: priorityLabels[order.priority] || order.priority,
      origin: originKey,
      originLabel: originLabels[originKey],
      environmentName: order.environmentName || null,
      sectorName: order.sectorName || null,
      assetName: asset?.name || null,
      assignedTechnicianName: order.assignedTechnicianName || null,
      createdAt: order.createdAt,
      firstResponseAt: order.firstResponseAt || null,
      slaDueAt: order.slaDueAt || null,
      closedAt: order.closedAt || null,
      reopenCount: order.reopenCount || 0,
      reopenReason: order.reopenReason || null,
      feedbackRating: order.feedback?.rating ?? null,
      feedbackComment: order.feedback?.comment ?? null
    };
  });

  const feedbackRatings = rows.map((row) => row.feedbackRating).filter((value) => Number.isFinite(value));

  const summary = {
    totalCount: rows.length,
    byStatus: countBy(rows, (row) => row.status, (id) => statusById.get(id)?.name || id),
    byPriority: countBy(rows, (row) => row.priority, (id) => priorityLabels[id] || id),
    byOrigin: countBy(rows, (row) => row.origin, (id) => originLabels[id] || id),
    byTechnician: countBy(rows, (row) => row.assignedTechnicianName).slice(0, 10),
    avgResolutionMinutes: averageMinutesBetween(
      rows.filter((row) => row.closedAt),
      "createdAt",
      "closedAt"
    ),
    avgFirstResponseMinutes: averageMinutesBetween(
      rows.filter((row) => row.firstResponseAt),
      "createdAt",
      "firstResponseAt"
    ),
    avgFeedbackRating: feedbackRatings.length ? average(feedbackRatings) : null
  };

  return { summary, rows, warnings: [] };
}

// --- SLA ------------------------------------------------------------------

/**
 * `calculateSla` deve ser a funcao `calculateServiceOrderSla` real de
 * server/src/repositories/serviceOrderRepository.js - injetada por
 * parametro para manter este modulo puro (sem import de repository/DB) e
 * testavel com um `now` fixo.
 */
export function buildSlaReport({ serviceOrders = [], statusSettings, calculateSla, now } = {}, filters = {}) {
  const { startDate, endDate, priority } = filters;

  const filtered = serviceOrders.filter((order) => {
    if (!inDateRange(order.createdAt, startDate, endDate)) return false;
    if (priority && order.priority !== priority) return false;
    return true;
  });

  const rows = filtered.map((order) => {
    const sla = calculateSla(order, statusSettings, now);
    return {
      id: order.id,
      number: order.number,
      title: order.title,
      priority: order.priority,
      priorityLabel: priorityLabels[order.priority] || order.priority,
      slaStatus: sla.status,
      slaStatusLabel: slaStatusLabels[sla.status] || sla.status,
      dueAt: sla.dueAt,
      remainingMinutes: sla.remainingMinutes,
      breached: sla.breached,
      nearDue: sla.nearDue,
      createdAt: order.createdAt,
      closedAt: order.closedAt || null
    };
  });

  const notApplicable = rows.filter((row) => row.slaStatus === "not_applicable");
  const applicable = rows.filter((row) => row.slaStatus !== "not_applicable");
  const openRows = applicable.filter((row) => !row.closedAt);
  const closedRows = applicable.filter((row) => row.closedAt);

  const resolvedClosed = closedRows.filter((row) => row.slaStatus === "resolved").length;
  const breachedClosed = closedRows.filter((row) => row.slaStatus === "breached").length;
  const closedApplicableTotal = resolvedClosed + breachedClosed;

  const summary = {
    totalCount: rows.length,
    notApplicableCount: notApplicable.length,
    applicableTotal: applicable.length,
    open: {
      onTrack: openRows.filter((row) => row.slaStatus === "on_track").length,
      nearDue: openRows.filter((row) => row.slaStatus === "near_due").length,
      breachedOpen: openRows.filter((row) => row.slaStatus === "breached").length
    },
    closed: { resolved: resolvedClosed, breachedClosed },
    closedCompliancePercent: closedApplicableTotal
      ? Math.round((resolvedClosed / closedApplicableTotal) * 100)
      : null
  };

  return {
    summary,
    rows,
    warnings: [
      "OS marcadas como \"Nao se aplica\" (sem prazo de SLA calculado) ficam fora de qualquer percentual deste relatorio."
    ]
  };
}

// --- Ativos -----------------------------------------------------------

export function buildAssetsReport({ devices = [], alerts = [] } = {}, filters = {}) {
  const { status, segmentName, assetType, search } = filters;

  const filtered = devices.filter((device) => {
    if (status && device.status !== status) return false;
    if (segmentName && !matchesSearchText(device.segmentName, segmentName)) return false;
    if (assetType && device.assetType !== assetType) return false;
    if (search && !matchesSearchText(device.name, search) && !matchesSearchText(device.ip, search)) return false;
    return true;
  });

  const rows = filtered.map((device) => ({
    id: device.id,
    name: device.name,
    assetType: device.assetType || "other",
    status: device.status,
    statusLabel: deviceStatusLabels[device.status] || device.status,
    segmentName: device.segmentName || "Nao organizadas",
    ip: device.ip || null,
    source: device.source || null,
    lastSeenAt: device.lastSeenAt || null,
    cpuPercent: deviceMetricPercent(device, "cpu"),
    ramPercent: deviceMetricPercent(device, "ram"),
    diskPercent: deviceMetricPercent(device, "disk")
  }));

  const deviceMap = buildDeviceMap(devices);

  const summary = {
    totalCount: rows.length,
    byStatus: countBy(rows, (row) => row.status, (id) => deviceStatusLabels[id] || id),
    byType: countBy(rows, (row) => row.assetType),
    bySegment: countBy(rows, (row) => row.segmentName),
    mostProblematic: rankAssetsByAlerts(alerts, deviceMap)
  };

  return {
    summary,
    rows,
    warnings: [
      "Metricas de CPU/RAM/disco ficam indisponiveis para ativos cuja origem de dados nao coleta esses indicadores (ex.: apenas OCS ou cadastro manual) - nunca sao mostradas como 0."
    ]
  };
}

// --- Alertas ------------------------------------------------------------

/**
 * `alerts` deve chegar com `category`/`typeLabel` ja resolvidos (via
 * alertService.getAlertCategory/getAlertCompactLabel) - este modulo nao
 * importa alertService para se manter puro/sem dependencia de servico.
 */
export function buildAlertsReport(
  { alerts = [], deviceMap = new Map(), suggestionByAlertId = new Map(), scriptExecutedAlertIds = new Set() } = {},
  filters = {}
) {
  const { startDate, endDate, severity, category, status, segmentName } = filters;

  const filtered = alerts.filter((alert) => {
    if (!inDateRange(alert.firstSeenAt || alert.lastSeenAt, startDate, endDate)) return false;
    if (severity && alert.severity !== severity) return false;
    if (category && alert.category !== category) return false;
    if (status && alert.status !== status) return false;
    if (segmentName) {
      const device = deviceMap.get(String(alert.hostId || alert.assetId || ""));
      if (!matchesSearchText(device?.segmentName, segmentName)) return false;
    }
    return true;
  });

  const rows = filtered.map((alert) => {
    const device = deviceMap.get(String(alert.hostId || alert.assetId || ""));
    const suggestion = suggestionByAlertId.get(alert.id);
    return {
      id: alert.id,
      assetName: device?.name || alert.hostName || null,
      type: alert.type,
      typeLabel: alert.typeLabel || alert.type,
      category: alert.category || null,
      severity: alert.severity,
      severityLabel: severityLabels[alert.severity] || alert.severity,
      metric: alert.metric || null,
      value: alert.value ?? null,
      threshold: alert.threshold ?? null,
      occurrencesCount: alert.occurrencesCount || 1,
      status: alert.status,
      firstSeenAt: alert.firstSeenAt || null,
      lastSeenAt: alert.lastSeenAt || null,
      suggestionStatus: suggestion?.status || null,
      generatedServiceOrderNumber: suggestion?.createdServiceOrderNumber || null,
      hasExecutedScript: scriptExecutedAlertIds.has(alert.id)
    };
  });

  const summary = {
    totalCount: rows.length,
    bySeverity: countBy(rows, (row) => row.severity, (id) => severityLabels[id] || id),
    byCategory: countBy(rows, (row) => row.category).slice(0, 10),
    topRecurringAssets: rankAssetsByAlerts(filtered, deviceMap),
    alertsWithSuggestionCount: rows.filter((row) => row.suggestionStatus).length,
    alertsThatBecameServiceOrderCount: rows.filter((row) => row.generatedServiceOrderNumber).length
  };

  return {
    summary,
    rows,
    warnings: [
      "Nao existe, hoje, vinculo entre alertas e planos preventivos no sistema - esse relatorio nunca mostra essa relacao, nem como \"indisponivel\"."
    ]
  };
}

// --- Scripts --------------------------------------------------------------

/**
 * `jobs` ja deve vir com stdout/stderr truncados pela propria consulta SQL
 * (reportRepository.listReportScriptJobs) - nunca com o conteudo integral.
 */
export function buildScriptsReport({ jobs = [] } = {}, filters = {}) {
  const { startDate, endDate, status, riskLevel } = filters;

  const filtered = jobs.filter((job) => {
    if (!inDateRange(job.createdAt, startDate, endDate)) return false;
    if (status && job.status !== status) return false;
    if (riskLevel && job.riskLevel !== riskLevel) return false;
    return true;
  });

  const rows = filtered.map((job) => ({
    id: job.id,
    assetName: job.assetName || null,
    scriptName: job.scriptName || null,
    riskLevel: job.riskLevel || null,
    status: job.status,
    timeoutSeconds: job.timeoutSeconds,
    requestedByName: job.requestedByName || null,
    claimedAt: job.claimedAt || null,
    completedAt: job.completedAt || null,
    durationMinutes: minutesBetween(job.claimedAt || job.createdAt, job.completedAt),
    exitCode: job.exitCode ?? null,
    timedOut: Boolean(job.timedOut),
    stdoutExcerpt: job.stdoutExcerpt || null,
    stderrExcerpt: job.stderrExcerpt || null,
    errorMessage: job.errorMessage || null,
    createdAt: job.createdAt
  }));

  const succeeded = rows.filter((row) => row.status === "succeeded").length;
  const timedOutCount = rows.filter((row) => row.timedOut).length;

  const summary = {
    totalCount: rows.length,
    byStatus: countBy(rows, (row) => row.status),
    byRiskLevel: countBy(rows, (row) => row.riskLevel),
    successRate: rows.length ? Math.round((succeeded / rows.length) * 100) : null,
    timeoutRate: rows.length ? Math.round((timedOutCount / rows.length) * 100) : null
  };

  return {
    summary,
    rows,
    warnings: [
      "Saida (stdout/stderr) e mostrada apenas como um trecho resumido - o conteudo completo do script nunca e incluido neste relatorio."
    ]
  };
}

// --- Assistencia Remota ---------------------------------------------------

/**
 * `sessions` deve vir apenas com metadados persistidos em
 * remote_assistance_sessions (reportRepository.listReportRemoteAssistanceSessions)
 * - nunca com frames, chat ou tokens.
 */
export function buildRemoteAssistanceReport({ sessions = [] } = {}, filters = {}) {
  const { startDate, endDate, status, connectionMode } = filters;

  const filtered = sessions.filter((session) => {
    if (!inDateRange(session.requestedAt || session.startedAt, startDate, endDate)) return false;
    if (status && session.status !== status) return false;
    if (connectionMode && session.connectionMode !== connectionMode) return false;
    return true;
  });

  const rows = filtered.map((session) => ({
    id: session.id,
    assetName: session.assetName || null,
    technicianName: session.technicianName || null,
    status: session.status,
    statusLabel: remoteAssistanceStatusLabels[session.status] || session.status,
    connectionMode: session.connectionMode,
    connectionModeLabel: connectionModeLabels[session.connectionMode] || session.connectionMode,
    consentStatus: session.consentStatus || null,
    requestedAt: session.requestedAt || null,
    startedAt: session.startedAt || null,
    endedAt: session.endedAt || null,
    durationMinutes: session.startedAt && session.endedAt ? minutesBetween(session.startedAt, session.endedAt) : null,
    endReason: session.endReason || null
  }));

  const durations = rows.map((row) => row.durationMinutes).filter((value) => Number.isFinite(value));

  const summary = {
    totalCount: rows.length,
    byStatus: countBy(rows, (row) => row.status, (id) => remoteAssistanceStatusLabels[id] || id),
    byConnectionMode: countBy(rows, (row) => row.connectionMode, (id) => connectionModeLabels[id] || id),
    byEndReason: countBy(rows, (row) => row.endReason),
    averageDurationMinutes: durations.length ? average(durations) : null
  };

  return {
    summary,
    rows,
    warnings: [
      "Quantidade de reconexoes e qualidade media de video nunca sao persistidas apos o fim da sessao - por isso nao aparecem neste relatorio."
    ]
  };
}
