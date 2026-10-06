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
        <dt>Próximas do prazo</dt>
        <dd>{data.nearDueCount}</dd>
      </div>
      <div>
        <dt>Resolução média</dt>
        <dd>{data.averageResolutionMinutes != null ? `${formatCount(data.averageResolutionMinutes)} min` : "--"}</dd>
      </div>
      <div>
        <dt>1ª resposta média</dt>
        <dd>{data.averageFirstResponseMinutes != null ? `${formatCount(data.averageFirstResponseMinutes)} min` : "--"}</dd>
      </div>
    </dl>
  );
}
