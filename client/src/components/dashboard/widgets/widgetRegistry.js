import AlertsBySeverityWidget from "./types/AlertsBySeverityWidget.jsx";
import AssetAvailabilityWidget from "./types/AssetAvailabilityWidget.jsx";
import CriticalAssetsWidget from "./types/CriticalAssetsWidget.jsx";
import CurrentProblemsWidget from "./types/CurrentProblemsWidget.jsx";
import MetricGaugeWidget from "./types/MetricGaugeWidget.jsx";
import MetricHistoryChartWidget from "./types/MetricHistoryChartWidget.jsx";
import RecentEventsWidget from "./types/RecentEventsWidget.jsx";
import ScriptExecutionsWidget from "./types/ScriptExecutionsWidget.jsx";
import ServiceOrdersByStatusWidget from "./types/ServiceOrdersByStatusWidget.jsx";
import ServiceOrdersOverdueWidget from "./types/ServiceOrdersOverdueWidget.jsx";
import ServiceOrdersSlaWidget from "./types/ServiceOrdersSlaWidget.jsx";
import StatusOverviewWidget from "./types/StatusOverviewWidget.jsx";
import TopAssetsWidget from "./types/TopAssetsWidget.jsx";

/**
 * Espelha o registry do servidor (server/src/services/dashboardWidgets/widgetRegistry.js)
 * pelas mesmas chaves de `type` -- um teste dedicado (widgetRegistry.test.js)
 * confere que os dois catalogos batem, para o drift entre cliente e servidor
 * nao passar despercebido.
 */
// configFields descreve quais campos o modal de configuracao generico
// (DashboardWidgetConfigModal.jsx) deve mostrar para cada tipo -- evita um
// switch por tipo dentro do modal.
export const widgetRegistry = {
  status_overview: { Component: StatusOverviewWidget, label: "Status Geral da Infraestrutura", configFields: [] },
  asset_availability: { Component: AssetAvailabilityWidget, label: "Disponibilidade de Ativos", configFields: [] },
  current_problems: { Component: CurrentProblemsWidget, label: "Problemas Atuais", configFields: ["limit"] },
  top_assets_cpu: { Component: TopAssetsWidget, label: "Top Ativos por CPU", configFields: ["limit"] },
  top_assets_ram: { Component: TopAssetsWidget, label: "Top Ativos por RAM", configFields: ["limit"] },
  top_assets_disk: { Component: TopAssetsWidget, label: "Top Ativos por Disco", configFields: ["limit"] },
  metric_history_cpu: {
    Component: MetricHistoryChartWidget,
    label: "Grafico Historico de CPU",
    requiresAssetConfig: true,
    configFields: ["asset", "period"]
  },
  metric_history_ram: {
    Component: MetricHistoryChartWidget,
    label: "Grafico Historico de RAM",
    requiresAssetConfig: true,
    configFields: ["asset", "period"]
  },
  metric_history_disk: {
    Component: MetricHistoryChartWidget,
    label: "Grafico Historico de Disco",
    requiresAssetConfig: true,
    configFields: ["asset", "period"]
  },
  metric_gauge_cpu: { Component: MetricGaugeWidget, label: "Gauge de CPU", requiresAssetConfig: true, configFields: ["asset"] },
  metric_gauge_ram: { Component: MetricGaugeWidget, label: "Gauge de RAM", requiresAssetConfig: true, configFields: ["asset"] },
  metric_gauge_disk: {
    Component: MetricGaugeWidget,
    label: "Gauge de Disco",
    requiresAssetConfig: true,
    configFields: ["asset"]
  },
  service_orders_by_status: { Component: ServiceOrdersByStatusWidget, label: "OS por Status", configFields: [] },
  service_orders_sla: { Component: ServiceOrdersSlaWidget, label: "SLA das OS", configFields: [] },
  service_orders_overdue: { Component: ServiceOrdersOverdueWidget, label: "OS Vencidas", configFields: ["limit"] },
  alerts_by_severity: { Component: AlertsBySeverityWidget, label: "Alertas por Severidade", configFields: [] },
  critical_assets: { Component: CriticalAssetsWidget, label: "Ativos Criticos", configFields: ["limit"] },
  recent_events: { Component: RecentEventsWidget, label: "Ultimos Eventos Tecnicos", configFields: ["limit"] },
  script_executions: { Component: ScriptExecutionsWidget, label: "Execucoes de Scripts", configFields: ["limit"] }
};

export const knownWidgetTypes = new Set(Object.keys(widgetRegistry));
