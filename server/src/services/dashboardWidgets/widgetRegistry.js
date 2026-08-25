import * as alertWidgets from "./alertWidgets.js";
import * as assetWidgets from "./assetWidgets.js";
import * as eventWidgets from "./eventWidgets.js";
import * as metricWidgets from "./metricWidgets.js";
import * as scriptWidgets from "./scriptWidgets.js";
import * as serviceOrderWidgets from "./serviceOrderWidgets.js";

/**
 * Um tipo de widget por chave de registro (nao um switch gigante). Cada
 * fetchData(config, ctx) devolve dados reais ou um estado explicito de "sem
 * dado"/"sem ativo selecionado" -- nunca um valor inventado. "Assistencia
 * Remota" (item 20 do catalogo pedido) fica de fora deliberadamente: nao
 * existe consulta multi-sessao em remoteAssistanceRepository.js hoje, e
 * criar uma tocaria o modulo que esta rodada foi orientada a nao alterar.
 */
export const widgetRegistry = {
  status_overview: {
    label: "Status Geral da Infraestrutura",
    category: "overview",
    defaultSize: { w: "l", h: "s" },
    fetchData: assetWidgets.fetchStatusOverview
  },
  asset_availability: {
    label: "Disponibilidade de Ativos",
    category: "assets",
    defaultSize: { w: "m", h: "s" },
    fetchData: assetWidgets.fetchAssetAvailability
  },
  current_problems: {
    label: "Problemas Atuais",
    category: "alerts",
    defaultSize: { w: "m", h: "m" },
    fetchData: alertWidgets.fetchCurrentProblems
  },
  top_assets_cpu: {
    label: "Top Ativos por CPU",
    category: "assets",
    defaultSize: { w: "m", h: "m" },
    fetchData: assetWidgets.fetchTopAssetsCpu
  },
  top_assets_ram: {
    label: "Top Ativos por RAM",
    category: "assets",
    defaultSize: { w: "m", h: "m" },
    fetchData: assetWidgets.fetchTopAssetsRam
  },
  top_assets_disk: {
    label: "Top Ativos por Disco",
    category: "assets",
    defaultSize: { w: "m", h: "m" },
    fetchData: assetWidgets.fetchTopAssetsDisk
  },
  metric_history_cpu: {
    label: "Grafico Historico de CPU",
    category: "metrics",
    defaultSize: { w: "l", h: "m" },
    requiresAssetConfig: true,
    validateConfig: metricWidgets.validateAssetMetricConfig,
    fetchData: metricWidgets.fetchMetricHistoryCpu
  },
  metric_history_ram: {
    label: "Grafico Historico de RAM",
    category: "metrics",
    defaultSize: { w: "l", h: "m" },
    requiresAssetConfig: true,
    validateConfig: metricWidgets.validateAssetMetricConfig,
    fetchData: metricWidgets.fetchMetricHistoryRam
  },
  metric_history_disk: {
    label: "Grafico Historico de Disco",
    category: "metrics",
    defaultSize: { w: "l", h: "m" },
    requiresAssetConfig: true,
    validateConfig: metricWidgets.validateAssetMetricConfig,
    fetchData: metricWidgets.fetchMetricHistoryDisk
  },
  metric_gauge_cpu: {
    label: "Gauge de CPU",
    category: "metrics",
    defaultSize: { w: "s", h: "s" },
    requiresAssetConfig: true,
    validateConfig: metricWidgets.validateAssetMetricConfig,
    fetchData: metricWidgets.fetchMetricGaugeCpu
  },
  metric_gauge_ram: {
    label: "Gauge de RAM",
    category: "metrics",
    defaultSize: { w: "s", h: "s" },
    requiresAssetConfig: true,
    validateConfig: metricWidgets.validateAssetMetricConfig,
    fetchData: metricWidgets.fetchMetricGaugeRam
  },
  metric_gauge_disk: {
    label: "Gauge de Disco",
    category: "metrics",
    defaultSize: { w: "s", h: "s" },
    requiresAssetConfig: true,
    validateConfig: metricWidgets.validateAssetMetricConfig,
    fetchData: metricWidgets.fetchMetricGaugeDisk
  },
  service_orders_by_status: {
    label: "OS por Status",
    category: "service_orders",
    defaultSize: { w: "m", h: "m" },
    fetchData: serviceOrderWidgets.fetchServiceOrdersByStatus
  },
  service_orders_sla: {
    label: "SLA das OS",
    category: "service_orders",
    defaultSize: { w: "m", h: "s" },
    fetchData: serviceOrderWidgets.fetchServiceOrdersSla
  },
  service_orders_overdue: {
    label: "OS Vencidas",
    category: "service_orders",
    defaultSize: { w: "m", h: "m" },
    fetchData: serviceOrderWidgets.fetchServiceOrdersOverdue
  },
  alerts_by_severity: {
    label: "Alertas por Severidade",
    category: "alerts",
    defaultSize: { w: "m", h: "s" },
    fetchData: alertWidgets.fetchAlertsBySeverity
  },
  critical_assets: {
    label: "Ativos Criticos",
    category: "assets",
    defaultSize: { w: "m", h: "m" },
    fetchData: assetWidgets.fetchCriticalAssets
  },
  recent_events: {
    label: "Ultimos Eventos Tecnicos",
    category: "events",
    defaultSize: { w: "l", h: "m" },
    fetchData: eventWidgets.fetchRecentEvents
  },
  script_executions: {
    label: "Execucoes de Scripts",
    category: "events",
    defaultSize: { w: "l", h: "m" },
    fetchData: scriptWidgets.fetchScriptExecutions
  }
};

export const knownWidgetTypes = new Set(Object.keys(widgetRegistry));

export function getWidgetCatalog() {
  return Object.entries(widgetRegistry).map(([type, entry]) => ({
    type,
    label: entry.label,
    category: entry.category,
    defaultSize: entry.defaultSize,
    requiresAssetConfig: Boolean(entry.requiresAssetConfig)
  }));
}
