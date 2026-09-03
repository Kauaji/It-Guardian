import { UserRound } from "lucide-react";
import { formatDate, getServiceLabel, getServiceOrderOriginLabel, slaStatusLabels } from "./serviceOrderBoardUtils.js";

const SLA_CARD_BADGE_STATUSES = new Set(["breached", "near_due"]);

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
  const slaStatus = order.sla?.status;
  const showSlaBadge = slaStatus && SLA_CARD_BADGE_STATUSES.has(slaStatus);
  const originLabel = getServiceOrderOriginLabel(order);
  const technicianLabel = order.assignedTechnicianNames?.length
    ? order.assignedTechnicianNames.join(", ")
    : order.technicianName || order.assignedTechnicianName || "Sem técnico";

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
      <span className="service-order-number">
        {order.number}
        {order.isDemo && <span className="demo-data-badge">Demo</span>}
        {showSlaBadge && (
          <span className={`service-order-sla-chip service-order-sla-chip-${slaStatus}`}>
            {slaStatusLabels[slaStatus]}
          </span>
        )}
        {originLabel !== "Manual" && <span className="service-order-origin-badge">{originLabel}</span>}
      </span>
      <strong>{order.title}</strong>
      <small>{asset?.name || order.assetName || "Sem máquina"}</small>
      <div className="service-order-card-tags">
        <em>{order.priorityLabel}</em>
        <em>{mainContext}</em>
        {secondaryContext && <em>{secondaryContext}</em>}
      </div>
      <footer>
        <span><UserRound size={14} />{technicianLabel}</span>
        <span>{formatDate(order.createdAt)}</span>
      </footer>
    </button>
  );
}
