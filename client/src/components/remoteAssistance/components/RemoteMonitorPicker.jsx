import { formatRemoteMonitor } from "../remoteAssistanceModel.js";

// Seletor de monitor (varios) ou rotulo do monitor unico; nada sem monitores.
export default function RemoteMonitorPicker({ session, monitors, changingMonitor, terminal, onChange }) {
  if (monitors.length > 1) {
    return (
      <label>
        <span className="sr-only">Trocar monitor</span>
        <select
          value={session.selectedMonitorId || monitors[0]?.id}
          onChange={(event) => onChange(event.target.value)}
          disabled={changingMonitor || terminal}
        >
          {monitors.map((monitor, index) => (
            <option key={monitor.id} value={monitor.id}>{formatRemoteMonitor(monitor, index)}</option>
          ))}
        </select>
      </label>
    );
  }
  if (monitors.length === 1) {
    return (
      <span className="remote-assistance-single-monitor">
        {formatRemoteMonitor(monitors[0], 0)} (unico monitor)
      </span>
    );
  }
  return null;
}
