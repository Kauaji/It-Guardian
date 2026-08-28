import WidgetCategoryChart from "../WidgetCategoryChart.jsx";
import { resolveVisualization } from "../widgetVisualizations.js";

const severityColors = { critical: "#d64545", high: "#e57842", medium: "#d69a21", warning: "#d69a21", low: "#3974cc", info: "#75869e" };

export default function AlertsBySeverityWidget({ data, config }) {
  const rows = (data.rows || []).map((row) => ({ id: row.severity, label: row.label, value: row.count, color: severityColors[row.severity] }));
  return <WidgetCategoryChart rows={rows} dimension="alertSeverity" variant={resolveVisualization("alerts_by_severity", config?.chartType)} emptyMessage="Nenhum alerta ativo neste recorte." />;
}
