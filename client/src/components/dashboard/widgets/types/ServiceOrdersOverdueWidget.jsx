import { formatDateTime } from "../../dashboardFormatters.js";
import WidgetList from "../WidgetList.jsx";

export default function ServiceOrdersOverdueWidget({ data }) {
  return (
    <WidgetList
      items={data.rows}
      emptyMessage="Nenhuma ordem de servico vencida no momento."
      renderItem={(order) => (
        <>
          <span>{order.number} - {order.title}</span>
          <strong className="danger">{Math.round(order.overdueMinutes / 60)}h vencida</strong>
          <small>Prazo era {formatDateTime(order.dueAt)}</small>
        </>
      )}
    />
  );
}
