import { healthClassificationTone } from "../../dashboardFormatters.js";
import GaugeSvg from "../GaugeSvg.jsx";
import WidgetStat from "../WidgetStat.jsx";

export default function StatusOverviewWidget({ data }) {
  const tone = healthClassificationTone(data.health?.classification);
  return (
    <div className="dashboard-widget-status-overview">
      <div className="dashboard-widget-status-gauge">
        {data.totalAssets === 0 ? (
          <p className="dashboard-health-empty">Sem ativos<small>Saúde indisponível neste recorte</small></p>
        ) : (
          <>
        <GaugeSvg value={data.health?.score} tone={tone} size={104} label="Saúde da infraestrutura" />
        <span className={"pill " + tone}>{data.health?.classificationLabel}</span>
        <small className="dashboard-widget-caption">Saúde do recorte</small>
          </>
        )}
      </div>
      <dl className="dashboard-widget-stat-grid">
        <WidgetStat label="Ativos" value={data.totalAssets} />
        <WidgetStat label="Online" value={data.onlineAssets} dimension="assetStatus" filterValue="online" />
        <WidgetStat label="Offline" value={data.offlineAssets} dimension="assetStatus" filterValue="offline" />
        <WidgetStat label="Críticos" value={data.criticalAssets} dimension="assetStatus" filterValue="problem" filterLabel="Erro" tone="danger" />
        <WidgetStat label="OS abertas" value={data.openServiceOrders} />
        <WidgetStat label="OS vencidas" value={data.overdueServiceOrders} dimension="overdue" filterValue={true} filterLabel="Vencidas" />
        <WidgetStat label="Alertas críticos" value={data.criticalAlerts} dimension="alertSeverity" filterValue="critical" filterLabel="Crítica" />
      </dl>
    </div>
  );
}
