import { formatEventDateTime } from "./assetTimelineFormatters.js";

function SummaryStat({ label, value }) {
  return (
    <div className="asset-timeline-summary-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function AssetTimelineSummary({ summary }) {
  if (!summary) return null;

  return (
    <div className="asset-timeline-summary">
      <SummaryStat label="Eventos" value={summary.totalEvents} />
      <SummaryStat label="OS abertas" value={summary.serviceOrdersOpened} />
      <SummaryStat label="OS finalizadas" value={summary.serviceOrdersClosed} />
      <SummaryStat label="Alertas críticos" value={summary.criticalAlerts} />
      <SummaryStat label="Preventivas" value={summary.preventives} />
      <SummaryStat label="Assistências remotas" value={summary.remoteSessions} />
      <SummaryStat
        label="Última manutenção"
        value={summary.lastMaintenanceAt ? formatEventDateTime(summary.lastMaintenanceAt) : "Sem registro"}
      />
      <SummaryStat
        label="Mapas de rede"
        value={summary.networkTopologyMapCount > 0 ? summary.networkTopologyMapCount : "Nenhum"}
      />
    </div>
  );
}
