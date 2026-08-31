import { Area, Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateTime } from "../../dashboardFormatters.js";
import { useDashboardFilters } from "../DashboardFilterContext.jsx";
import WidgetChartFrame from "../WidgetChartFrame.jsx";
import { resolveVisualization } from "../widgetVisualizations.js";

const metricLabels = { cpu: "CPU", ram: "RAM", disk: "Disco" };

export default function MetricHistoryChartWidget({ data, config }) {
  const { enabled, toggleFilter, filters } = useDashboardFilters();
  if (!config?.assetId) return <p className="dashboard-empty-state">Configure um ativo para este widget.</p>;

  const label = metricLabels[data.metric] || data.metric;
  const chartData = (data.points || []).map((point) => ({ label: formatDateTime(point.collectedAt), value: point.value }));
  const variant = resolveVisualization("metric_history_" + data.metric, config.chartType);
  const Series = variant === "area" ? Area : variant === "columns" ? Bar : Line;

  return (
    <>
      <WidgetChartFrame empty={chartData.length === 0} emptyMessage={"Sem histórico suficiente de " + label + " neste recorte."}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" minTickGap={34} tick={{ fill: "var(--text-soft)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} allowDecimals={false} tick={{ fill: "var(--text-soft)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value) => [value + "%", "Uso"]} />
          <Series type="monotone" dataKey="value" stroke="#1f7a61" fill="#1f7a61" fillOpacity={variant === "area" ? .15 : 1} strokeWidth={2} dot={false} isAnimationActive={false} maxBarSize={24} />
        </ComposedChart>
      </WidgetChartFrame>
      {data.summary && <div className="dashboard-widget-caption-row"><span>Média: {data.summary.average}%</span><span>Pico: {data.summary.max}%</span><span>Mínimo: {data.summary.min}%</span></div>}
      <button type="button" className="dashboard-asset-link" disabled={!enabled} aria-pressed={filters.assetId === config.assetId} onClick={() => toggleFilter("assetId", config.assetId, data.assetName || data.asset?.name || "Ativo do histórico")}>Analisar este ativo nos outros gráficos</button>
    </>
  );
}
