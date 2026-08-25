import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "../../../../utils/display.js";
import WidgetChartFrame from "../WidgetChartFrame.jsx";

const metricLabels = { cpu: "CPU", ram: "RAM", disk: "Disco" };

// Mesmo padrao documentado em docs/DASHBOARD.md: precisa espalhar
// ...responsiveProps no componente real do recharts dentro do
// ResponsiveContainer, senao renderiza uma div em branco sem erro nenhum.
function MetricTrendChart({ data, ...responsiveProps }) {
  return (
    <LineChart data={data} {...responsiveProps}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft, #e2e8f0)" />
      <XAxis dataKey="label" stroke="#69758a" />
      <YAxis domain={[0, 100]} allowDecimals={false} stroke="#69758a" />
      <Tooltip formatter={(value) => [`${value}%`, "Uso"]} />
      <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} />
    </LineChart>
  );
}

export default function MetricHistoryChartWidget({ data, config }) {
  if (!config?.assetId) {
    return <p className="dashboard-empty-state">Configure um ativo para este widget.</p>;
  }

  const label = metricLabels[data.metric] || data.metric;
  const chartData = (data.points || []).map((point) => ({ label: formatDate(point.collectedAt), value: point.value }));

  return (
    <>
      <WidgetChartFrame
        empty={chartData.length === 0}
        emptyMessage={`Sem historico suficiente de ${label} para este ativo ainda.`}
      >
        <MetricTrendChart data={chartData} />
      </WidgetChartFrame>
      {data.summary && (
        <div className="dashboard-widget-caption-row">
          <span>Media: {data.summary.average}%</span>
          <span>Pico: {data.summary.max}%</span>
          <span>Minimo: {data.summary.min}%</span>
        </div>
      )}
    </>
  );
}
