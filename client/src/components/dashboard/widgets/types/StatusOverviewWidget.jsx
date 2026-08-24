import { healthClassificationTone } from "../../dashboardFormatters.js";
import GaugeSvg from "../GaugeSvg.jsx";

export default function StatusOverviewWidget({ data }) {
  const tone = healthClassificationTone(data.health?.classification);

  return (
    <div className="dashboard-widget-status-overview">
      <div className="dashboard-widget-status-gauge">
        <GaugeSvg value={data.health?.score} tone={tone} label="Saude da infraestrutura" />
        <span className={`pill ${tone}`}>{data.health?.classificationLabel}</span>
      </div>
      <dl className="dashboard-widget-stat-grid">
        <div>
          <dt>Ativos</dt>
          <dd>{data.totalAssets}</dd>
        </div>
        <div>
          <dt>Online</dt>
          <dd>{data.onlineAssets}</dd>
        </div>
        <div>
          <dt>Offline</dt>
          <dd>{data.offlineAssets}</dd>
        </div>
        <div>
          <dt>Criticos</dt>
          <dd>{data.criticalAssets}</dd>
        </div>
        <div>
          <dt>OS abertas</dt>
          <dd>{data.openServiceOrders}</dd>
        </div>
        <div>
          <dt>OS vencidas</dt>
          <dd>{data.overdueServiceOrders}</dd>
        </div>
        <div>
          <dt>Alertas criticos</dt>
          <dd>{data.criticalAlerts}</dd>
        </div>
      </dl>
    </div>
  );
}
