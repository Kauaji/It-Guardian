import { calculateInfrastructureHealth } from "../../../../shared/infrastructureHealth.js";

const CRITICAL_METRIC_THRESHOLD = 90;

function hasObservedStatus(machine) {
  return machine?.status && machine.status !== "unknown";
}

function isCriticalMetric(value) {
  return Number.isFinite(value) && value >= CRITICAL_METRIC_THRESHOLD;
}

export function calculateSegmentHealth(machines = []) {
  const source = Array.isArray(machines) ? machines : [];
  const observed = source.filter(hasObservedStatus);

  if (!observed.length) {
    return {
      score: null,
      classification: "no-data",
      classificationLabel: "Sem dados",
      deductions: [],
      observedAssets: 0,
      totalAssets: source.length
    };
  }

  const result = calculateInfrastructureHealth({
    totalAssets: observed.length,
    offlineAssets: observed.filter((machine) => ["offline", "problem"].includes(machine.status)).length,
    criticalDiskAssets: observed.filter((machine) => isCriticalMetric(machine.metrics?.disk)).length,
    criticalPerformanceAssets: observed.filter(
      (machine) => isCriticalMetric(machine.metrics?.cpu) || isCriticalMetric(machine.metrics?.ram)
    ).length,
    staleHeartbeatAssets: observed.filter((machine) => machine.status === "problem").length
  });

  return {
    ...result,
    observedAssets: observed.length,
    totalAssets: source.length
  };
}

export function describeSegmentHealth(health) {
  if (health.score == null) {
    return `Sem nota: nenhuma das ${health.totalAssets} máquina(s) possui monitoramento atual.`;
  }

  const coverage = `Cobertura: ${health.observedAssets} de ${health.totalAssets} máquina(s).`;
  const factors = health.deductions.length
    ? `Descontos: ${health.deductions.map((item) => `${item.reason} (-${item.points})`).join("; ")}.`
    : "Nenhum sinal crítico detectado.";

  return `Nota ${health.score} de 100 · ${health.classificationLabel}. ${coverage} ${factors}`;
}
