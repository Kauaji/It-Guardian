import { isMaintenanceSegmentName, formatDate } from "../../utils/display.js";
import { normalizeText } from "./alertUtils.js";

const DAY_MS = 86400000;

// Junta os indicadores de automacao do dispositivo com os planos da gestao de automacoes.
export function mergeAutomationIndicators(devices, managementMachines = []) {
  const automationMachinesById = new Map(managementMachines.map((machine) => [String(machine.assetId), machine]));

  return devices.map((device) => {
    const managementMachine = automationMachinesById.get(String(device.id));
    const indicatorsByPlanId = new Map();

    for (const indicator of [...(device.automationIndicators || []), ...(managementMachine?.plans || [])]) {
      const planId = indicator.automationPlanId || indicator.id;
      if (planId) indicatorsByPlanId.set(String(planId), indicator);
    }

    return {
      ...device,
      automationIndicators: [...indicatorsByPlanId.values()]
    };
  });
}

// Preventiva mais recente registrada para a maquina (data do ativo, do plano ou de criacao).
export function getLastPreventiveForAsset(preventivePlans, assetId) {
  const matches = preventivePlans
    .filter((plan) => Array.isArray(plan.assets) && plan.assets.some((asset) => String(asset.assetId) === String(assetId)))
    .map((plan) => {
      const asset = plan.assets.find((item) => String(item.assetId) === String(assetId));
      const date = asset?.preparedAt || plan.preparedAt || plan.createdAt;

      return {
        plan,
        asset,
        date,
        timestamp: new Date(date || 0).getTime()
      };
    })
    .sort((left, right) => right.timestamp - left.timestamp);

  return matches[0] || null;
}

function resolvePreventiveStatus({ lastPreventive, isOverdue, relatedAlerts, criticalAlerts, isInMaintenance, isBackup }) {
  let preventiveStatus = "up_to_date";
  let preventiveStatusLabel = "Preventiva em dia";
  let urgency = 10;

  if (!lastPreventive) {
    preventiveStatus = "no_preventive";
    preventiveStatusLabel = "Sem preventiva";
    urgency = 70;
  } else if (isOverdue) {
    preventiveStatus = "overdue";
    preventiveStatusLabel = "Preventiva vencida";
    urgency = 82;
  }

  if (relatedAlerts.length) urgency = Math.max(urgency, 62);
  if (criticalAlerts) {
    preventiveStatus = "critical";
    preventiveStatusLabel = "Crítica";
    urgency = 100;
  }
  if (isInMaintenance) urgency = Math.max(urgency, 90);
  if (isBackup && !criticalAlerts && !isInMaintenance) urgency = Math.min(urgency, 20);

  return { preventiveStatus, preventiveStatusLabel, urgency };
}

function buildStatusBadges({ preventiveStatus, preventiveStatusLabel, relatedAlerts, criticalAlerts, isInMaintenance, isBackup }) {
  const badges = [
    {
      label: preventiveStatusLabel,
      tone: preventiveStatus === "up_to_date" ? "ok" : preventiveStatus === "critical" ? "danger" : "warning"
    }
  ];

  if (relatedAlerts.length) {
    badges.push({ label: "1 aviso", tone: criticalAlerts ? "danger" : "warning" });
  }
  if (isInMaintenance) badges.push({ label: "Em manutenção", tone: "warning" });
  if (isBackup) badges.push({ label: "Backup", tone: "neutral" });

  return badges;
}

// Situacao preventiva de uma maquina: ultima preventiva, vencimento, avisos,
// urgencia de ordenacao e selos exibidos na linha.
export function buildDevicePreventiveInfo(device, { lookups, alerts, preventivePlans, dueDays, now = Date.now() }) {
  const location = lookups.getDevicePreventiveLocation(device);
  const lastPreventive = getLastPreventiveForAsset(preventivePlans, device.id);
  const relatedAlerts = alerts.filter((alert) => {
    const alertDevice = lookups.findAlertDevice(alert);
    return alertDevice?.id === device.id && alert.status !== "resolved";
  });
  const criticalAlerts = relatedAlerts.filter((alert) => alert.severity === "critical").length;
  const isInMaintenance =
    Boolean(device.maintenance || device.maintenanceActive) ||
    device.maintenanceStatus === "active" ||
    isMaintenanceSegmentName(device.segmentName);
  const isBackup = Boolean(device.isBackup);
  const lastTimestamp = lastPreventive?.timestamp || null;
  const daysSinceLastPreventive = lastTimestamp ? Math.max(0, Math.floor((now - lastTimestamp) / DAY_MS)) : null;
  const nextPreventiveDueAt = lastTimestamp ? new Date(lastTimestamp + dueDays * DAY_MS).toISOString() : null;
  const isOverdue = Number.isFinite(daysSinceLastPreventive) && daysSinceLastPreventive > dueDays;
  const status = resolvePreventiveStatus({ lastPreventive, isOverdue, relatedAlerts, criticalAlerts, isInMaintenance, isBackup });

  return {
    device,
    location,
    lastPreventive,
    activeAlertsCount: relatedAlerts.length,
    criticalAlertsCount: criticalAlerts,
    isInMaintenance,
    isBackup,
    isOverdue,
    ...status,
    nextPreventiveDueAt,
    daysSinceLastPreventive,
    badges: buildStatusBadges({ ...status, relatedAlerts, criticalAlerts, isInMaintenance, isBackup })
  };
}

export function summarizePreventiveOverview(overview) {
  return overview.reduce(
    (summary, item) => {
      if (item.preventiveStatus === "no_preventive") summary.withoutPreventive += 1;
      if (item.isOverdue) summary.overdue += 1;
      if (item.preventiveStatus === "up_to_date") summary.upToDate += 1;
      if (item.activeAlertsCount) summary.withAlerts += 1;
      return summary;
    },
    { withoutPreventive: 0, overdue: 0, upToDate: 0, withAlerts: 0 }
  );
}

function matchesPreventiveFilter(item, filter) {
  return (
    filter === "all" ||
    (filter === "no_preventive" && item.preventiveStatus === "no_preventive") ||
    (filter === "overdue" && item.isOverdue) ||
    (filter === "up_to_date" && item.preventiveStatus === "up_to_date") ||
    (filter === "alerts" && item.activeAlertsCount > 0) ||
    (filter === "maintenance" && item.isInMaintenance) ||
    (filter === "backup" && item.isBackup)
  );
}

function matchesPreventiveSearch(item, term) {
  const { device, location } = item;

  return [
    device.name,
    device.id,
    device.ip,
    device.statusLabel,
    device.type,
    device.assetType,
    location.tabName,
    location.groupName,
    location.segmentName,
    item.preventiveStatusLabel,
    item.lastPreventive?.plan?.name
  ]
    .filter(Boolean)
    .some((value) => normalizeText(value).includes(term));
}

// Aplica filtro de status e busca textual, ordenando por urgencia e nome.
export function filterPreventiveOverview(overview, { search, filter }) {
  const term = normalizeText(search);

  return overview
    .filter((item) => {
      if (!matchesPreventiveFilter(item, filter)) return false;
      return !term || matchesPreventiveSearch(item, term);
    })
    .sort((left, right) => {
      if (right.urgency !== left.urgency) return right.urgency - left.urgency;
      return String(left.device.name || left.device.id).localeCompare(String(right.device.name || right.device.id));
    });
}

// Agrupa por ambiente/grupo/segmento, preservando a ordem recebida.
export function groupPreventiveOverview(items) {
  return Array.from(
    items
      .reduce((groups, item) => {
        const key = `${item.location.tabName}::${item.location.groupName}::${item.location.segmentName}`;
        const current = groups.get(key) || { key, ...item.location, devices: [] };
        current.devices.push(item);
        groups.set(key, current);
        return groups;
      }, new Map())
      .values()
  );
}

// Dados de apresentacao de uma linha de maquina na etapa 1.
export function getPreventiveRowView(item, dueDays) {
  const { device, badges, nextPreventiveDueAt } = item;
  const lastPreventive = item.lastPreventive
    ? {
        ...item.lastPreventive.plan,
        preparedAt: item.lastPreventive.date,
        createdAt: item.lastPreventive.date
      }
    : null;
  const normalizedDeviceStatus = normalizeText(`${device.statusLabel || ""} ${device.status || ""}`);

  return {
    lastPreventive,
    nextPreventiveLabel: nextPreventiveDueAt
      ? `Próxima sugerida: ${formatDate(nextPreventiveDueAt)}`
      : `Vence após ${dueDays} dia(s) da primeira preventiva`,
    hasPreventiveError:
      item.criticalAlertsCount > 0 ||
      badges.some((badge) => badge.tone === "danger") ||
      normalizedDeviceStatus.includes("erro") ||
      normalizedDeviceStatus.includes("offline")
  };
}

// Recomendadas primeiro; depois os demais (ou os ativos, se nao houve recomendacao).
export function orderPreventiveScripts(recommendations, activeScripts) {
  const recommended = recommendations.recommended || [];
  const baseList = recommendations.others?.length ? recommendations.others : activeScripts;

  return [...recommended, ...baseList.filter((script) => !recommended.some((item) => item.id === script.id))];
}

export function buildManualPreventivePlanPayload({ name, assetIds, scriptIds, riskAcknowledged }) {
  return {
    name,
    description: "Plano preventivo registrado pela tela de Avisos.",
    source: "manual",
    notes: "",
    riskAcknowledged,
    assetIds,
    scriptIds
  };
}

// Pedido de abertura do assistente de automacao a partir da selecao atual.
export function buildAutomationCreateRequest({ devices, scripts, riskScripts, planName, id = Date.now() }) {
  const deviceNames = devices.map((device) => device.name || device.hostname || device.id).filter(Boolean);
  const scriptNames = scripts.map((script) => script.name || script.id).filter(Boolean);
  const selectionKey = [...devices.map((device) => device.id).sort(), "|", ...scripts.map((script) => script.id).sort()].join(":");
  const assetIds = devices.map((device) => device.id).filter(Boolean);

  return {
    id,
    defaults: {
      name: planName || "Plano preventivo automatizado",
      description: deviceNames.length
        ? `Automação criada a partir da seleção preventiva: ${deviceNames.slice(0, 6).join(", ")}${deviceNames.length > 6 ? "..." : ""}.`
        : "Automação criada a partir do fluxo de preventivas.",
      defaultScriptIds: scripts.map((script) => script.id),
      context: {
        selectionKey,
        assetCount: devices.length,
        assetNames: deviceNames,
        assetIds,
        scriptNames,
        riskCount: riskScripts.length
      },
      scopeType: "asset_list",
      scopeId: "",
      assetIds
    }
  };
}

export function buildAutomatedPreventivePlanPayload({ automationPayload, planName, devices, scripts }) {
  const assetIds = devices.map((device) => device.id).filter(Boolean);
  const scriptIds = scripts.map((script) => script.id).filter(Boolean);
  const name = automationPayload.name || planName || "Plano preventivo automatizado";

  return {
    name,
    description: automationPayload.description || "",
    source: "automated",
    notes: automationPayload.notes || automationPayload.description || "",
    status: "prepared",
    riskAcknowledged: true,
    assetIds,
    scriptIds,
    automation: {
      ...automationPayload,
      enabled: true,
      name,
      scopeType: "asset_list",
      scopeId: null,
      assetIds,
      defaultScriptIds: scriptIds
    }
  };
}
