import { AlertTriangle, Server, ShieldCheck, WifiOff } from "lucide-react";
import SummaryCard from "../../ui/SummaryCard.jsx";

export default function DashboardAssetsCard({ summary }) {
  return (
    <section className="panel dashboard-assets-card">
      <div className="panel-heading">
        <h3>Ativos monitorados</h3>
      </div>
      <div className="summary-grid">
        <SummaryCard icon={Server} label="Dispositivos" value={summary.totalDevices} />
        <SummaryCard icon={ShieldCheck} label="Online" value={summary.online} tone="ok" />
        <SummaryCard icon={WifiOff} label="Offline" value={summary.offline} tone="warning" />
        <SummaryCard icon={AlertTriangle} label="Erro" value={summary.problem} tone="danger" />
        <SummaryCard icon={AlertTriangle} label="Críticos" value={summary.criticalAlerts} tone="danger" />
      </div>
    </section>
  );
}
