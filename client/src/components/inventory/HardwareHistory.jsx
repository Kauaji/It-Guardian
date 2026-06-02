function formatDateTime(value) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function HardwareHistory({ changes = [], compact = false }) {
  const items = compact ? changes.slice(0, 3) : changes;

  return (
    <div className={compact ? "hardware-history compact" : "hardware-history"}>
      {items.map((change) => (
        <article key={change.id} className="hardware-change">
          <time>{formatDateTime(change.detectedAt || change.createdAt)}</time>
          <strong>{change.change || change.message}</strong>
          <p>
            <span>{change.oldValue || "Não informado"}</span>
            <b>-&gt;</b>
            <span>{change.newValue || "Não informado"}</span>
          </p>
        </article>
      ))}
      {!items.length && <p className="empty">Nenhuma mudanca detectada.</p>}
    </div>
  );
}
