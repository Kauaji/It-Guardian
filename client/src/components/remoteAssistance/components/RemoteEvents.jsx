import { formatDateTime } from "../utils/format.js";

export default function RemoteEvents({ events }) {
  return (
    <section className="remote-assistance-events" aria-label="Eventos recentes da sessão">
      <h3>Auditoria recente</h3>
      <div>
        {events.slice(0, 5).map((item) => (
          <p key={item.id}><span>{formatDateTime(item.createdAt)}</span>{item.message}</p>
        ))}
        {!events.length && <p>Nenhum evento recebido ainda.</p>}
      </div>
    </section>
  );
}
