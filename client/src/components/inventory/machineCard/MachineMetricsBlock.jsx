import { Clock3, Cpu, MemoryStick } from "lucide-react";
import MetricBadge from "../metrics/MetricBadge.jsx";
import { formatLastPing, metricTone } from "./machineCardPresentation.js";

function MetricValue({ value }) {
  return <strong className={value == null ? "" : metricTone(value)}>{value == null ? "--" : `${value}%`}</strong>;
}

export default function MachineMetricsBlock({ machine, metrics, isManualAsset, onOpenMetricModal }) {
  if (isManualAsset) {
    return (
      <div className="network-asset-facts">
        <div>
          <span>Marca/modelo</span>
          <strong>
            {machine.manualAsset?.brand} {machine.manualAsset?.model}
          </strong>
        </div>
        <div>
          <span>Patrimônio</span>
          <strong>{machine.manualAsset?.assetTag}</strong>
        </div>
        <div>
          <span>
            <Clock3 size={13} /> Ping
          </span>
          <strong>{formatLastPing(machine.lastPingAt)}</strong>
        </div>
      </div>
    );
  }
  return (
    <div className="machine-metrics">
      <MetricBadge metric="cpu" onOpenModal={onOpenMetricModal}>
        <span>
          <Cpu size={13} /> CPU
        </span>
        <MetricValue value={metrics.cpu} />
      </MetricBadge>
      <MetricBadge metric="ram" onOpenModal={onOpenMetricModal}>
        <span>
          <MemoryStick size={13} /> RAM
        </span>
        <MetricValue value={metrics.ram} />
      </MetricBadge>
    </div>
  );
}
