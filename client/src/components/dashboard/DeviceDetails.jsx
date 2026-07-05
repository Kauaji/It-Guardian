import { Cpu, HardDrive, MemoryStick, Monitor, Network } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatDate } from "../../utils/display.js";
import MetricBar from "./MetricBar.jsx";

export default function DeviceDetails({ device, statusClass, metricClass }) {
  if (!device) {
    return (
      <section className="panel details-empty">
        <Monitor size={24} />
        <p>Selecione um dispositivo para ver detalhes.</p>
      </section>
    );
  }
  const isManualAsset = device.source === "manual";

  return (
    <section className="panel details-panel">
      <div className="panel-heading">
        <div>
          <h2>{device.name}</h2>
          <p>{device.ip} - {device.hardware?.os}</p>
        </div>
        <span className={`pill ${statusClass(device.status)}`}>{device.statusLabel}</span>
      </div>

      {isManualAsset ? (
        <div className="network-card">
          <Network size={18} />
          <span>Status por ping: {device.statusLabel || (device.status === "offline" ? "Erro" : "Online")}</span>
        </div>
      ) : (
        <>
          <div className="metric-grid">
            <MetricBar label="CPU" value={device.metrics.cpu} icon={Cpu} metricClass={metricClass} />
            <MetricBar label="RAM" value={device.metrics.ram} icon={MemoryStick} metricClass={metricClass} />
            <MetricBar label="Disco" value={device.metrics.disk} icon={HardDrive} metricClass={metricClass} />
          </div>

          <div className="chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={device.history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d7dde9" />
                <XAxis dataKey="time" stroke="#69758a" />
                <YAxis stroke="#69758a" />
                <Tooltip />
                <Line type="monotone" dataKey="cpu" stroke="#d64545" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ram" stroke="#d6a21f" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="disk" stroke="#2f9e73" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="inventory-grid">
        <div><span>Fabricante</span><strong>{device.hardware?.manufacturer}</strong></div>
        <div><span>Modelo</span><strong>{device.hardware?.model}</strong></div>
        <div><span>{isManualAsset ? "Tipo" : "CPU"}</span><strong>{isManualAsset ? device.assetType : device.hardware?.cpuModel}</strong></div>
        <div><span>{isManualAsset ? "Patrimônio" : "Memória"}</span><strong>{isManualAsset ? device.hardware?.assetTag : `${device.hardware?.ramGb} GB`}</strong></div>
        <div><span>Uptime</span><strong>{device.uptimeHours} h</strong></div>
        <div><span>Inventário</span><strong>{formatDate(device.hardware?.lastInventoryAt)}</strong></div>
      </div>

      <div className="software-list">
        {device.hardware?.software.map((software) => <span key={software}>{software}</span>)}
      </div>
    </section>
  );
}
