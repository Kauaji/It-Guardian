import WidgetCategoryChart from "../WidgetCategoryChart.jsx";
import { assetStatusColors, assetStatusLabels, resolveVisualization } from "../widgetVisualizations.js";

export default function AssetAvailabilityWidget({ data, config }) {
  const rows = Object.entries(data.byStatus || {}).map(([id, value]) => ({ id, value, label: assetStatusLabels[id] || id, color: assetStatusColors[id] }));
  return <WidgetCategoryChart rows={rows} dimension="assetStatus" variant={resolveVisualization("asset_availability", config?.chartType)} emptyMessage="Nenhum ativo neste recorte." showPercentages percentageTotal={data.total} />;
}
