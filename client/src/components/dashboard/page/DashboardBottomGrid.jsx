import { useMemo } from "react";
import { Network } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDisplayText } from "../../alerts/alertUtils.js";
import { useSettledWidthKey } from "../../../hooks/useSettledWidthKey.js";
import DeviceDetails from "../DeviceDetails.jsx";
import { metricClass, statusClass } from "../dashboardFormatters.js";
import { buildAlertTrend } from "../dashboardModel.js";

function HistoryPanel({ history }) {
  const alertTrend = useMemo(() => buildAlertTrend(history), [history]);
  const settledWidthKey = useSettledWidthKey();

  return (
    <section className="panel history-panel">
      <div className="panel-heading">
        <h2>Histórico de avisos</h2>
        <Network size={18} />
      </div>
      <div className="chart-box compact-chart">
        <ResponsiveContainer key={settledWidthKey} width="100%" height={170}>
          <AreaChart data={alertTrend}>
            <XAxis dataKey="label" stroke="#69758a" />
            <YAxis allowDecimals={false} stroke="#69758a" />
            <Tooltip />
            <Area dataKey="critical" stackId="1" stroke="#d64545" fill="#d64545" />
            <Area dataKey="warning" stackId="1" stroke="#d6a21f" fill="#d6a21f" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="history-list">
        {history.map((alert) => (
          <div key={alert.id}>
            <span className={`dot ${alert.severity}`} />
            <strong>{formatDisplayText(alert.hostName || alert.assetName, "Máquina não vinculada")}</strong>
            <span>{formatDisplayText(alert.title, "Aviso")}{alert.acknowledgement ? " - resolvido" : ""}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DashboardBottomGrid({ selectedDevice, history }) {
  return (
    <section className="bottom-grid">
      <DeviceDetails
        device={selectedDevice}
        statusClass={statusClass}
        metricClass={metricClass}
      />
      <HistoryPanel history={history} />
    </section>
  );
}
