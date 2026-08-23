import { X } from "lucide-react";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { useModalLifecycle } from "../../../hooks/useModalLifecycle.js";
import { formatDate } from "../../../utils/display.js";
import DashboardChartCard from "../../dashboard/DashboardChartCard.jsx";
import { useMetricHistory } from "./useMetricHistory.js";

const METRIC_LABELS = { cpu: "CPU", ram: "RAM", disk: "Disco" };
const PERIOD_OPTIONS = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" }
];

/**
 * Mesmo padrao de SimpleTrendChart (DashboardPage.jsx) - dentro do
 * ResponsiveContainer de DashboardChartCard, precisa espalhar
 * ...responsiveProps no componente real do recharts, senao renderiza uma
 * div em branco sem erro nenhum (ver docs/DASHBOARD.md).
 */
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

export default function MetricHistoryModal({ metric, deviceId, deviceName, token, onClose }) {
  const [period, setPeriod] = useState("24h");
  const dialogRef = useModalLifecycle(Boolean(metric), onClose);
  const { data, loading, error } = useMetricHistory({
    token,
    deviceId,
    metric: metric || "cpu",
    period,
    enabled: Boolean(metric)
  });

  if (!metric) return null;

  const label = METRIC_LABELS[metric] || metric;
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label || period;
  const chartData = (data?.points || []).map((point) => ({
    label: formatDate(point.collectedAt),
    value: point.value
  }));

  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={dialogRef} className="modal-panel metric-history-modal" role="dialog" aria-modal="true" aria-label={`Historico de ${label}`}>
        <header>
          <div>
            <h2>Historico de {label}</h2>
            <p>{deviceName}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="metric-history-modal-periods">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`secondary-action ${period === option.value ? "active" : ""}`}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="error-message">{error}</p>
        ) : (
          <DashboardChartCard
            title={`${label} - ${periodLabel}`}
            loading={loading}
            empty={!loading && chartData.length === 0}
            emptyMessage="Sem historico suficiente para esta metrica neste periodo."
            height={260}
          >
            <MetricTrendChart data={chartData} />
          </DashboardChartCard>
        )}

        {!loading && !error && data?.summary && (
          <div className="metric-history-modal-summary">
            <span>Media: {data.summary.average}%</span>
            <span>Pico: {data.summary.max}%</span>
            <span>Minimo: {data.summary.min}%</span>
            <span>Amostras: {data.summary.samples}</span>
          </div>
        )}
      </section>
    </div>
  );
}
