import { ClipboardList } from "lucide-react";

export default function BoardSummary({ configuredStatuses, visibleServiceOrders }) {
  return (
    <section className="service-orders-summary">
      <article>
        <ClipboardList size={18} />
        <span>Total</span>
        <strong>{visibleServiceOrders.length}</strong>
      </article>
      {configuredStatuses.map((status) => (
        <article key={status.id} style={{ "--service-order-status-color": status.color }}>
          <span>{status.name}</span>
          <strong>{visibleServiceOrders.filter((order) => order.status === status.id).length}</strong>
        </article>
      ))}
    </section>
  );
}
