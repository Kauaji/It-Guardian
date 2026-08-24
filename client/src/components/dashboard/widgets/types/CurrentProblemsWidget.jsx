import { formatDateTime } from "../../dashboardFormatters.js";
import WidgetList from "../WidgetList.jsx";

const severityTones = { critical: "danger", high: "danger", medium: "warning", low: "", warning: "warning" };

export default function CurrentProblemsWidget({ data }) {
  return (
    <WidgetList
      items={data.rows}
      emptyMessage="Nenhum problema ativo no momento."
      renderItem={(alert) => (
        <>
          <span>{alert.hostName || alert.hostId}</span>
          <span className={`pill ${severityTones[alert.severity] || ""}`}>{alert.severityLabel}</span>
          <small>{alert.typeLabel} - {formatDateTime(alert.lastSeenAt)}</small>
        </>
      )}
    />
  );
}
