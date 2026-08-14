export function buildAlertTrend(history) {
  return (history || []).slice(0, 6).reverse().map((alert, index) => ({
    label: `#${index + 1}`,
    critical: alert.severity === "critical" ? 1 : 0,
    warning: alert.severity === "warning" ? 1 : 0
  }));
}

export function onlineSubtitle(overview) {
  if (!overview) return "";
  return `${overview.onlineAssets} de ${overview.totalAssets} maquinas online`;
}

export function offlineSubtitle(overview) {
  if (!overview) return "";
  const total = overview.offlineAssets + overview.criticalAssets;
  if (!total) return "Nenhum ativo sem contato recente";
  return `${total} ativo(s) sem contato recente`;
}

export function criticalAlertsSubtitle(overview) {
  if (!overview) return "";
  if (!overview.criticalAlerts) return "Nenhum alerta critico ativo";
  return `${overview.criticalAlerts} alerta(s) critico(s) ativo(s)`;
}

export function overdueSubtitle(overview) {
  if (!overview) return "";
  if (!overview.overdueServiceOrdersAvailable) {
    return "Depende de prazo/SLA persistido (ainda nao disponivel)";
  }
  return `${overview.overdueServiceOrders} ordem(ns) vencida(s)`;
}

export function healthSubtitle() {
  return "Calculada a partir de ativos, alertas e ordens de servico reais";
}

export function isSectionEmpty(entries) {
  return !Array.isArray(entries) || entries.length === 0;
}
