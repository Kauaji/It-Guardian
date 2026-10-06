import { Clock3 } from "lucide-react";
import { formatDate } from "../utils/text.js";

function HistoryEvent({ event }) {
  return (
    <article>
      <Clock3 size={15} />
      <div>
        <strong>{event.message}</strong>
        <span>{formatDate(event.createdAt)} - {event.userName || "Sistema"}</span>
        {(event.oldValue || event.newValue) && (
          <small>{event.oldValue || "-"} {"->"} {event.newValue || "-"}</small>
        )}
      </div>
    </article>
  );
}

// Historico da OS seguido do historico tecnico do ativo.
export default function HistoryTab({ serviceOrder, asset }) {
  const history = serviceOrder.history || [];
  return (
    <section className="service-order-history-panel">
      {!asset && <p className="empty">Vincule uma máquina para visualizar o histórico técnico do ativo.</p>}
      <div className="service-order-history-list">
        {history.length ? history.map((event) => (
          <HistoryEvent key={event.id} event={event} />
        )) : (
          <p className="empty">Sem histórico de OS registrado.</p>
        )}
        {(asset?.assetHistory || []).map((event) => (
          <HistoryEvent key={`asset-${event.id}`} event={event} />
        ))}
      </div>
    </section>
  );
}
