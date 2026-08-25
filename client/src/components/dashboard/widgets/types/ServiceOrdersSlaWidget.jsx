import { formatCount } from "../../dashboardFormatters.js";

export default function ServiceOrdersSlaWidget({ data }) {
  return (
    <dl className="dashboard-widget-stat-grid">
      <div>
        <dt>Abertas</dt>
        <dd>{data.openCount}</dd>
      </div>
      <div className={data.overdueCount > 0 ? "danger" : ""}>
        <dt>Vencidas</dt>
        <dd>{data.overdueCount}</dd>
      </div>
      <div className={data.nearDueCount > 0 ? "warning" : ""}>
        <dt>Proximas do prazo</dt>
        <dd>{data.nearDueCount}</dd>
      </div>
      <div>
        <dt>Resolucao media</dt>
        <dd>{data.averageResolutionMinutes != null ? `${formatCount(data.averageResolutionMinutes)} min` : "--"}</dd>
      </div>
      <div>
        <dt>1a resposta media</dt>
        <dd>{data.averageFirstResponseMinutes != null ? `${formatCount(data.averageFirstResponseMinutes)} min` : "--"}</dd>
      </div>
    </dl>
  );
}
