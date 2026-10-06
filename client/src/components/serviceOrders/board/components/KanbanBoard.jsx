import { defaultPriorityColors } from "../../serviceOrderBoardUtils.js";
import ServiceOrderCard from "../../ServiceOrderCard.jsx";

function KanbanColumn({ status, orders, dnd, assetById, priorityColors, businessMode, onOpen }) {
  return (
    <section
      className={`service-order-column ${dnd.dragOverStatus === status.id ? "is-drop-target" : ""}`}
      style={{ "--service-order-status-color": status.color }}
      onDragOver={(event) => dnd.handleColumnDragOver(event, status.id)}
      onDragLeave={dnd.handleColumnDragLeave}
      onDrop={(event) => dnd.handleDrop(event, status.id)}
    >
      <header>
        <strong>{status.name}</strong>
        <span>{orders.length}</span>
      </header>
      <div className="service-order-column-list">
        {orders.length ? orders.map((order) => (
          <ServiceOrderCard
            key={order.id}
            order={order}
            asset={assetById.get(order.assetId)}
            priorityColor={priorityColors[order.priority] || defaultPriorityColors[order.priority]}
            businessMode={businessMode}
            dragging={dnd.draggingOrderId === order.id}
            onDragStart={dnd.handleDragStart}
            onDragEnd={dnd.handleDragEnd}
            onOpen={onOpen}
          />
        )) : (
          <p className="empty">Nenhuma OS neste status.</p>
        )}
      </div>
    </section>
  );
}

// Quadro kanban: uma coluna por status configurado, com os cartoes das OS visiveis.
export default function KanbanBoard({ layout, configuredStatuses, visibleServiceOrders, ...columnProps }) {
  return (
    <section className={`service-order-kanban layout-${layout}`} aria-label="Ordens por status">
      {configuredStatuses.map((status) => (
        <KanbanColumn
          key={status.id}
          status={status}
          orders={visibleServiceOrders.filter((order) => order.status === status.id)}
          {...columnProps}
        />
      ))}
    </section>
  );
}
