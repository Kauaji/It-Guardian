const classificationLabels = {
  healthy: "Saudavel",
  attention: "Atencao",
  critical: "Critico",
  emergency: "Emergencial"
};

function classify(score) {
  if (score >= 85) return "healthy";
  if (score >= 70) return "attention";
  if (score >= 50) return "critical";
  return "emergency";
}

/**
 * Nota de saude da infraestrutura: comeca em 100 e perde pontos por sinais
 * operacionais reais (nunca por dado ausente). Cada fator tem um teto de
 * deducao proprio para que um unico problema nao domine a nota sozinho.
 */
export function calculateInfrastructureHealth({
  totalAssets = 0,
  offlineAssets = 0,
  criticalAlerts = 0,
  overdueServiceOrders = 0,
  criticalDiskAssets = 0,
  criticalPerformanceAssets = 0,
  staleHeartbeatAssets = 0,
  recurringProblemAssets = 0
} = {}) {
  const deductions = [];
  let score = 100;

  function deduct(points, reason) {
    const rounded = Math.round(points * 10) / 10;
    if (rounded <= 0) return;
    score -= rounded;
    deductions.push({ reason, points: rounded });
  }

  const offlineRatio = totalAssets > 0 ? offlineAssets / totalAssets : 0;
  deduct(
    Math.min(40, offlineRatio * 40),
    `${Math.round(offlineRatio * 100)}% dos ativos offline (${offlineAssets} de ${totalAssets})`
  );
  deduct(Math.min(20, criticalAlerts * 4), `${criticalAlerts} alerta(s) critico(s) ativo(s)`);
  deduct(Math.min(15, overdueServiceOrders * 3), `${overdueServiceOrders} ordem(ns) de servico vencida(s)`);
  deduct(Math.min(15, criticalDiskAssets * 3), `${criticalDiskAssets} ativo(s) com disco em estado critico`);
  deduct(
    Math.min(10, criticalPerformanceAssets * 2),
    `${criticalPerformanceAssets} ativo(s) com CPU ou memoria em alerta`
  );
  deduct(
    Math.min(10, staleHeartbeatAssets * 2),
    `${staleHeartbeatAssets} ativo(s) sem contato recente do agente`
  );
  deduct(
    Math.min(10, recurringProblemAssets * 2),
    `${recurringProblemAssets} ativo(s) com reincidencia de problemas`
  );

  score = Math.max(0, Math.min(100, Math.round(score)));
  const classification = classify(score);

  return {
    score,
    classification,
    classificationLabel: classificationLabels[classification],
    deductions
  };
}
