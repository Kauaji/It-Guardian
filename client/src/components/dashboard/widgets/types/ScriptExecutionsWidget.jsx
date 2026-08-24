import { formatDateTime } from "../../dashboardFormatters.js";
import WidgetList from "../WidgetList.jsx";

export default function ScriptExecutionsWidget({ data }) {
  return (
    <WidgetList
      items={data.rows}
      emptyMessage="Nenhuma execucao de script registrada ainda."
      renderItem={(log) => (
        <>
          <span>{log.scriptName || "Script removido"}</span>
          <span className={`pill ${log.errorDetected ? "danger" : "ok"}`}>{log.status}</span>
          <small>{log.executedBy || "Agente"} - {formatDateTime(log.executedAt || log.createdAt)}</small>
        </>
      )}
    />
  );
}
