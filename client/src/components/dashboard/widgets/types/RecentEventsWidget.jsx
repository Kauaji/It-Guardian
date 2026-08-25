import { formatDateTime } from "../../dashboardFormatters.js";
import WidgetList from "../WidgetList.jsx";

export default function RecentEventsWidget({ data }) {
  return (
    <WidgetList
      items={data.rows}
      emptyMessage="Nenhum evento registrado ainda."
      renderItem={(log) => (
        <>
          <span>{log.message}</span>
          <small>{log.userName || "Sistema"} - {formatDateTime(log.createdAt)}</small>
        </>
      )}
    />
  );
}
