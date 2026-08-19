import { ShieldAlert, Timer } from "lucide-react";

const SLA_STATUS_LABELS = {
  on_track: "No prazo",
  near_due: "Próxima do vencimento",
  breached: "Vencida",
  resolved: "Resolvida dentro do prazo",
  not_applicable: "Sem SLA definido"
};

function formatDate(value) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDuration(minutes) {
  if (minutes == null) return "-";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = Math.round(abs % 60);
  const label = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  return minutes < 0 ? `${label} em atraso` : label;
}

export default function ServiceOrderSlaTab({ serviceOrder }) {
  const sla = serviceOrder?.sla || { status: "not_applicable", dueAt: null, remainingMinutes: null };

  return (
    <section className="service-order-sla-panel">
      <div className={`service-order-sla-status service-order-sla-${sla.status}`}>
        <ShieldAlert size={18} />
        <div>
          <strong>{SLA_STATUS_LABELS[sla.status] || sla.status}</strong>
          {sla.dueAt && <span>Prazo: {formatDate(sla.dueAt)}</span>}
        </div>
      </div>

      {sla.status === "not_applicable" ? (
        <p className="empty">
          Esta OS não tem prazo de SLA calculável (prioridade sem prazo configurado nas configurações de SLA).
        </p>
      ) : (
        <div className="service-order-detail-grid">
          <div className="service-order-detail-item">
            <span>Tempo restante</span>
            <strong>{sla.status === "resolved" || sla.status === "breached" && !sla.dueAt ? "-" : formatDuration(sla.remainingMinutes)}</strong>
          </div>
        </div>
      )}

      <div className="service-order-detail-grid">
        <div className="service-order-detail-item">
          <span>Primeira resposta</span>
          <strong>{serviceOrder?.firstResponseAt ? formatDate(serviceOrder.firstResponseAt) : "Ainda não houve"}</strong>
        </div>
        <div className="service-order-detail-item">
          <span>SLA vencido em</span>
          <strong>{serviceOrder?.slaBreachedAt ? formatDate(serviceOrder.slaBreachedAt) : "Não vencido"}</strong>
        </div>
        <div className="service-order-detail-item">
          <span>Reaberturas</span>
          <strong>{serviceOrder?.reopenCount || 0}</strong>
        </div>
      </div>

      {serviceOrder?.reopenedAt && (
        <div className="service-order-sla-reopen-note">
          <Timer size={14} />
          <span>
            Última reabertura em {formatDate(serviceOrder.reopenedAt)}
            {serviceOrder.reopenReason ? `: ${serviceOrder.reopenReason}` : ""}
          </span>
        </div>
      )}
    </section>
  );
}
