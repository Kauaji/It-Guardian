import WidgetCategoryChart from "../WidgetCategoryChart.jsx";
import { resolveVisualization } from "../widgetVisualizations.js";

export default function ServiceOrdersByStatusWidget({ data, config }) {
  const rows = (data.rows || []).map((row) => ({ id: row.status, label: row.label, value: row.count }));
  return <WidgetCategoryChart rows={rows} dimension="serviceOrderStatus" variant={resolveVisualization("service_orders_by_status", config?.chartType)} emptyMessage="Nenhuma ordem de serviço neste recorte." />;
}
