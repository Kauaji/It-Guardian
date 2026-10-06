import { Ban, Laptop } from "lucide-react";
import { formatDateTime } from "./cloudAdminModel.js";

function ActivationItem({ item, busy, onDeactivate }) {
  return (
    <article>
      <span className={`cloud-activation-status ${item.status}`}>
        <span />
        {item.status === "active" ? "Ativo" : "Desativado"}
      </span>
      <div>
        <strong>{item.alias || item.hostname}</strong>
        <small>
          {item.alias ? `${item.hostname} - ` : ""}
          coletor {item.collectorVersion || "sem versão"}
        </small>
      </div>
      <small>Primeira ativacao: {formatDateTime(item.firstSeenAt)}</small>
      <small>Último contato: {formatDateTime(item.lastSeenAt)}</small>
      <button
        type="button"
        className="danger-action compact-action"
        disabled={item.status !== "active" || busy}
        onClick={() => onDeactivate(item)}
      >
        <Ban size={15} />
        Desativar
      </button>
    </article>
  );
}

export default function ActivationList({ selectedKey, activations, loading, busyAction, onDeactivate }) {
  return (
    <section className="cloud-admin-section">
      <div className="cloud-admin-section-title">
        <div>
          <Laptop size={18} />
          <strong>Computadores de {selectedKey.displayName}</strong>
        </div>
        <span>{activations.length} registro(s)</span>
      </div>
      {loading && <p className="empty">Carregando computadores...</p>}
      {!loading && activations.length === 0 && (
        <p className="empty">Nenhum computador ativou esta chave.</p>
      )}
      <div className="cloud-activation-list">
        {activations.map((item) => (
          <ActivationItem
            key={item.id}
            item={item}
            busy={busyAction === `activation:${item.id}`}
            onDeactivate={onDeactivate}
          />
        ))}
      </div>
    </section>
  );
}
