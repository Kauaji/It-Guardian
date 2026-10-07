import { Ban, Check, KeyRound, RefreshCw } from "lucide-react";
import { formatDateTime } from "./cloudAdminModel.js";

function ProductKeyItem({ item, expanded, busy, onToggle, onChangeStatus }) {
  return (
    <article className={item.active ? "" : "inactive"}>
      <button type="button" className="cloud-key-summary" onClick={onToggle} aria-expanded={expanded}>
        <span className={`cloud-key-state${item.active ? " active" : ""}`}>{item.active ? <Check size={15} /> : <Ban size={15} />}</span>
        <span>
          <strong>{item.displayName}</strong>
          <small>
            {item.organizationName} - {item.planName}
          </small>
        </span>
        <code>{item.keyHint}</code>
        <span className="cloud-key-usage">
          {item.activationCount} / {item.activationLimit}
          <small>ativacoes</small>
        </span>
        <span className="cloud-key-expiry">{item.expiresAt ? `Expira ${formatDateTime(item.expiresAt)}` : "Sem expiracao"}</span>
      </button>
      <div className="cloud-key-actions">
        <button
          type="button"
          className={item.active ? "danger-action compact-action" : "secondary-action compact-action"}
          onClick={() => onChangeStatus(item)}
          disabled={busy}
        >
          {item.active ? <Ban size={15} /> : <Check size={15} />}
          {item.active ? "Desativar" : "Reativar"}
        </button>
      </div>
    </article>
  );
}

export default function ProductKeyList({ productKeys, loading, selectedKeyId, busyAction, onRefresh, onSelect, onChangeStatus }) {
  return (
    <section className="cloud-admin-section">
      <div className="cloud-admin-section-title">
        <div>
          <KeyRound size={18} />
          <strong>Chaves de produto</strong>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onRefresh}
          disabled={loading}
          title="Atualizar chaves"
          aria-label="Atualizar chaves"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading && <p className="empty">Carregando chaves...</p>}
      {!loading && productKeys.length === 0 && <p className="empty">Nenhuma chave de produto cadastrada.</p>}
      <div className="cloud-key-list">
        {productKeys.map((item) => (
          <ProductKeyItem
            key={item.id}
            item={item}
            expanded={selectedKeyId === item.id}
            busy={busyAction === `key:${item.id}`}
            onToggle={() => onSelect((current) => (current === item.id ? "" : item.id))}
            onChangeStatus={onChangeStatus}
          />
        ))}
      </div>
    </section>
  );
}
