import { Server } from "lucide-react";
import PulseDot from "../ui/PulseDot.jsx";

function pulseTone(status) {
  return {
    online: "ok",
    offline: "offline",
    problem: "danger"
  }[status] || "offline";
}

export default function DeviceTable({ devices, selectedId, onSelect, statusClass }) {
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>Dispositivo</th>
            <th>IP</th>
            <th>Status</th>
            <th>CPU</th>
            <th>RAM</th>
            <th>Disco</th>
            <th>Hardware</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr
              key={device.id}
              className={selectedId === device.id ? "selected" : ""}
              onClick={() => onSelect(device.id)}
            >
              <td>
                <div className="device-name">
                  <PulseDot tone={pulseTone(device.status)} title={device.statusLabel} />
                  <Server size={16} />
                  <strong>{device.name}</strong>
                </div>
              </td>
              <td className="tabular-nums">{device.ip}</td>
              <td><span className={`pill ${statusClass(device.status)}`}>{device.statusLabel}</span></td>
              <td className="tabular-nums">{device.metrics?.cpu ?? "-"}{device.metrics ? "%" : ""}</td>
              <td className="tabular-nums">{device.metrics?.ram ?? "-"}{device.metrics ? "%" : ""}</td>
              <td className="tabular-nums">{device.metrics?.disk ?? "-"}{device.metrics ? "%" : ""}</td>
              <td>{device.hardware?.model || "Sem inventario"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
