// Presentation only: changing the visual never changes a widget's data source.
export const visualizationLabels = {
  stats: "Indicadores", bars: "Barras", columns: "Colunas", pie: "Pizza",
  donut: "Rosca", line: "Linha", area: "Área", list: "Lista", gauge: "Medidor"
};

export function widgetVisualizations(type) {
  if (type === "asset_availability") return ["donut", "bars", "columns", "pie", "stats"];
  if (type === "alerts_by_severity" || type === "service_orders_by_status") return ["bars", "columns", "pie", "donut"];
  if (type?.startsWith("top_assets_")) return ["bars", "columns", "list"];
  if (type?.startsWith("metric_history_")) return ["line", "area", "columns"];
  if (type?.startsWith("metric_gauge_")) return ["gauge"];
  if (type === "status_overview" || type === "service_orders_sla") return ["stats"];
  return ["list"];
}

export function resolveVisualization(type, requested) {
  const available = widgetVisualizations(type);
  return available.includes(requested) ? requested : available[0];
}

export const chartColors = ["#1f7a61", "#3974cc", "#d69a21", "#d64545", "#75869e", "#4eada5"];
export const assetStatusLabels = { online: "Online", offline: "Offline", problem: "Erro", unknown: "Sem dados" };
export const assetStatusColors = { online: "#1f7a61", offline: "#d69a21", problem: "#d64545", unknown: "#75869e" };
