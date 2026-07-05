import { AlertTriangle, Bell, CheckCircle } from "lucide-react";
import { formatDate } from "../../utils/display.js";

export default function AlertList({ alerts }) {
  return (
    <section className="panel alerts-panel">
      <div className="panel-heading">
        <h2>Avisos ativos</h2>
        <Bell size={18} />
      </div>
      <div className="alert-stack">
        {alerts.map((alert) => (
          <article key={alert.id} className={`alert-item ${alert.severity}`}>
            <AlertTriangle size={18} />
            <div>
              <strong>{alert.title}</strong>
              <span>{alert.hostName} - {formatDate(alert.startedAt)}</span>
              <p>{alert.description}</p>
              {alert.acknowledgement && (
                <small className="inline-resolved">
                  <CheckCircle size={13} />
                  Resolvido
                </small>
              )}
            </div>
          </article>
        ))}
        {!alerts.length && <p className="empty">Nenhum aviso ativo.</p>}
      </div>
    </section>
  );
}
