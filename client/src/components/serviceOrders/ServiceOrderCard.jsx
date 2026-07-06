import { UserRound } from "lucide-react";
import { formatDate, getServiceLabel } from "./serviceOrderBoardUtils.js";

export default function ServiceOrderCard({
  order,
  asset,
  priorityColor,
  businessMode,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen
}) {
  const priorityBackground = `color-mix(in srgb, ${priorityColor} 32%, var(--surface))`;
  const mainContext = businessMode ? order.environmentName || "Sem cliente" : order.sectorName || "Geral";
  const secondaryContext = businessMode ? order.sectorName || "Geral" : getServiceLabel(order);

  return (
    <button
      type="button"
      className={`service-order-card priority-${order.priority} ${dragging ? "is-dragging" : ""}`}
      style={{
        "--service-order-priority-color": priorityColor,
        "--service-order-priority-bg": priorityBackground
      }}
      draggable
      onDragStart={(event) => onDragStart(event, order)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(order)}
    >
      <span className="service-order-number">{order.number}</span>
      <strong>{order.title}</strong>
      <small>{asset?.name || order.assetName || "Sem máquina"}</small>
      <div className="service-order-card-tags">
        <em>{order.priorityLabel}</em>
        <em>{mainContext}</em>
        {secondaryContext && <em>{secondaryContext}</em>}
      </div>
      <footer>
        <span><UserRound size={14} />{order.technicianName || "Sem técnico"}</span>
        <span>{formatDate(order.createdAt)}</span>
      </footer>
    </button>
  );
}
