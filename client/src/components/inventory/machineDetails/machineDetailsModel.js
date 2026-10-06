import { formatHardwareValue } from "../hardwarePresentation.js";

export function formatDate(value) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "Não informado";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = bytes;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount.toFixed(unitIndex >= 3 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return "Não informado";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days > 0 ? `${days} d ${hours} h` : `${hours} h`;
}

export function buildMetricAlert({ metric, label, value, warningLimit = 70, criticalLimit = 85 }) {
  if (value == null || value < warningLimit) return null;

  const isCritical = value >= criticalLimit;
  return {
    id: `metric-${metric}`,
    description: `${label} acima do limite: ${value}%`,
    detectedAt: new Date().toISOString(),
    type: "Métrica",
    severity: isCritical ? "Crítico" : "Atenção",
    metric: label,
    value: `${value}%`,
    limit: `${isCritical ? criticalLimit : warningLimit}%`,
    status: "Ativo"
  };
}

export function buildActiveAlerts(machine) {
  if (!machine) return [];

  const alerts = [];
  const metrics = machine.metrics || {};

  [buildMetricAlert({ metric: "cpu", label: "CPU", value: metrics.cpu }),
    buildMetricAlert({ metric: "ram", label: "RAM", value: metrics.ram }),
    buildMetricAlert({ metric: "disk", label: "Disco", value: metrics.disk })]
    .filter(Boolean)
    .forEach((alert) => alerts.push(alert));

  if (machine.status === "offline") {
    alerts.push({
      id: "ping-offline",
      description: "Máquina não responde ping",
      detectedAt: machine.lastPingAt || new Date().toISOString(),
      type: "Conectividade",
      severity: "Crítico",
      metric: "Ping",
      value: "Sem resposta",
      limit: "Resposta esperada",
      status: "Ativo"
    });
  }

  for (const alert of machine.alerts || []) {
    if (alert.status !== "active") continue;
    alerts.push({
      id: alert.id,
      description: formatHardwareValue(alert.description || alert.title, "Alerta ativo no monitoramento"),
      detectedAt: alert.startedAt,
      type: formatHardwareValue(alert.title, "Alerta ativo"),
      severity: alert.severity === "critical" ? "Crítico" : "Atenção",
      metric: formatHardwareValue(alert.metric, "Monitoramento"),
      value: formatHardwareValue(alert.value, "Ativo"),
      limit: formatHardwareValue(alert.limit, "Regra de monitoramento"),
      status: "Ativo"
    });
  }

  if (machine.status === "problem" && !alerts.length) {
    alerts.push({
      id: "monitoring-problem",
      description: "Alerta ativo no monitoramento",
      detectedAt: new Date().toISOString(),
      type: "Monitoramento",
      severity: "Atenção",
      metric: "Status",
      value: "Problema",
      limit: "Operação normal",
      status: "Ativo"
    });
  }

  return alerts;
}

export function buildResolvedAlerts(machine, hardware) {
  return [...(machine?.assetHistory || []), ...(hardware?.changeHistory || [])]
    .filter((item) => /resolvid|normal|voltou|restaur/i.test(`${item.change || ""} ${item.message || ""}`))
    .map((item) => ({
      id: item.id || `${item.detectedAt || item.createdAt}-${item.change || item.message}`,
      description: item.change || item.message || "Erro resolvido",
      detectedAt: item.detectedAt || item.createdAt,
      type: "Histórico",
      severity: "Informativo",
      metric: item.field || "Ativo",
      value: item.newValue || "Normal",
      limit: item.oldValue || "Anterior",
      status: "Resolvido"
    }));
}

export function normalizeSoftware(software) {
  if (typeof software === "string") {
    return {
      name: software,
      version: null,
      manufacturer: null,
      installedAt: null
    };
  }

  return {
    name: software?.name || software?.title || "Software sem nome",
    version: software?.version || null,
    manufacturer: software?.manufacturer || software?.publisher || null,
    installedAt: software?.installedAt || software?.installDate || null
  };
}

export function getDiskHealth(hardware = {}) {
  const directHealth =
    hardware.diskHealth ||
    hardware.storageHealth ||
    hardware.smartHealth ||
    hardware.smartStatus;

  if (directHealth) {
    if (typeof directHealth === "object") {
      return directHealth.status || directHealth.value || directHealth.health || "Não disponível";
    }
    return directHealth;
  }

  const diskWithHealth = (hardware.disks || []).find((disk) =>
    disk.health || disk.smartStatus || disk.healthPercent !== undefined || disk.status
  );

  if (!diskWithHealth) return "Não disponível";
  if (diskWithHealth.healthPercent !== undefined) return `${diskWithHealth.healthPercent}%`;
  return diskWithHealth.health || diskWithHealth.smartStatus || diskWithHealth.status || "Não disponível";
}

export function isMaintenanceSegmentName(name = "") {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase() === "manutencao";
}

export const MACHINE_TABS = [
  { id: "general", label: "Geral" },
  { id: "alerts", label: "Alertas" },
  { id: "hardware", label: "Hardware" },
  { id: "software", label: "Softwares" },
  { id: "network", label: "Rede" },
  { id: "peripherals", label: "Periféricos" },
  { id: "notes", label: "Observações" },
  { id: "history", label: "Prontuário Técnico" }
];

// A aba de alertas so aparece quando ha alertas ativos ou resolvidos.
export function getVisibleTabs(activeAlertCount, resolvedAlertCount) {
  return MACHINE_TABS.filter((tab) => {
    if (tab.id === "alerts") return activeAlertCount > 0 || resolvedAlertCount > 0;
    return true;
  });
}

export function getMemoryModules(hardware) {
  if (Array.isArray(hardware.memoryModules)) return hardware.memoryModules;
  if (Array.isArray(hardware.memoryHealth?.moduleDetails)) return hardware.memoryHealth.moduleDetails;
  return [];
}
