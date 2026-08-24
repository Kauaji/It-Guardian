import { metricClass } from "../../dashboardFormatters.js";
import GaugeSvg from "../GaugeSvg.jsx";

const metricLabels = { cpu: "CPU", ram: "RAM", disk: "Disco" };
const toneByMetricClass = { ok: "ok", warning: "warning", danger: "danger" };

export default function MetricGaugeWidget({ data, config }) {
  if (!config?.assetId) {
    return <p className="dashboard-empty-state">Configure um ativo para este widget.</p>;
  }
  if (!data.available) {
    return <p className="dashboard-empty-state">Ativo nao encontrado ou sem dado recente.</p>;
  }

  const tone = Number.isFinite(data.value) ? toneByMetricClass[metricClass(data.value)] : "ok";

  return (
    <div className="dashboard-widget-gauge">
      <GaugeSvg value={data.value} tone={tone} label={`${metricLabels[data.metric] || data.metric} de ${data.assetName}`} suffix="%" />
      <span className="dashboard-widget-caption">{data.assetName}</span>
    </div>
  );
}
