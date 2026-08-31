// Presentation only: changing the visual never changes a widget's data source.
export const visualizationLabels = {
  stats: "Indicadores", bars: "Barras", columns: "Colunas", pie: "Pizza",
  donut: "Rosca", line: "Linha", area: "Área", list: "Lista", gauge: "Medidor",
  radial: "Anéis radiais", heatmap: "Mapa de calor"
};

export function widgetVisualizations(type) {
  if (type === "asset_availability") return ["donut", "bars", "columns", "pie", "stats"];
  if (type === "alerts_by_severity") return ["donut", "bars", "columns", "pie"];
  if (type === "service_orders_by_status") return ["columns", "bars", "pie", "donut"];
  if (type === "top_assets_cpu") return ["columns", "bars", "list"];
  if (type === "top_assets_ram") return ["radial", "columns", "bars", "list"];
  if (type === "top_assets_disk") return ["heatmap", "bars", "columns", "list"];
  if (type?.startsWith("metric_history_")) return ["line", "area", "columns"];
  if (type?.startsWith("metric_gauge_")) return ["gauge"];
  if (type === "status_overview" || type === "service_orders_sla") return ["stats"];
  return ["list"];
}

export function resolveVisualization(type, requested) {
  const available = widgetVisualizations(type);
  return available.includes(requested) ? requested : available[0];
}

const percentageFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function formatPercentage(value, total) {
  const numericValue = Number(value);
  const numericTotal = Number(total);
  if (!Number.isFinite(numericValue) || !Number.isFinite(numericTotal) || numericTotal <= 0) return "0%";
  const percentage = Math.min(100, Math.max(0, (numericValue / numericTotal) * 100));
  return percentageFormatter.format(percentage) + "%";
}

export const chartColors = ["#1f7a61", "#3974cc", "#d69a21", "#d64545", "#75869e", "#4eada5"];
export const assetStatusLabels = { online: "Online", offline: "Offline", problem: "Erro", unknown: "Sem dados" };
export const assetStatusColors = { online: "#1f7a61", offline: "#d69a21", problem: "#d64545", unknown: "#75869e" };
