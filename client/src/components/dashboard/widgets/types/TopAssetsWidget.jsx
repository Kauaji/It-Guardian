import WidgetCategoryChart from "../WidgetCategoryChart.jsx";
import { resolveVisualization } from "../widgetVisualizations.js";

const metricLabels = { cpu: "CPU", ram: "RAM", disk: "Disco" };

export default function TopAssetsWidget({ data, config }) {
  const rows = (data.rows || []).map((asset) => ({ id: asset.id, label: asset.name, value: asset.value }));
  return (
    <>
      <WidgetCategoryChart rows={rows} variant={resolveVisualization("top_assets_" + data.metric, config?.chartType)} dimension="assetId" suffix="%" emptyMessage={"Nenhum ativo com dado de " + (metricLabels[data.metric] || "uso") + " neste recorte."} />
      {rows.length > 0 && <small className="dashboard-widget-caption">Uso atual · clique em um ativo para analisar</small>}
    </>
  );
}
