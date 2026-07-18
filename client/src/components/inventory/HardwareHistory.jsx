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
      {items.map((change) => {
        const title = change.change || change.message;
        const hasTechnicalDetails = Boolean(change.oldValue || change.newValue || change.userName);

        return (
          <article key={change.id} className="hardware-change">
            <time>{formatDateTime(change.detectedAt || change.createdAt)}</time>
            {hasTechnicalDetails ? (
              <details>
                <summary>
                  <strong>{title}</strong>
                  <span>Ver detalhes</span>
                </summary>
                <div className="hardware-change-details">
                  {change.userName && (
                    <p>
                      <b>Responsavel</b>
                      <span>{change.userName}</span>
                    </p>
                  )}
                  {change.oldValue && (
                    <p>
                      <b>Valor anterior</b>
                      <span>{change.oldValue}</span>
                    </p>
                  )}
                  {change.newValue && (
                    <p>
                      <b>Detalhes</b>
                      <span>{change.newValue}</span>
                    </p>
                  )}
                </div>
              </details>
            ) : (
              <strong>{title}</strong>
            )}
          </article>
        );
      })}
      {!items.length && <p className="empty">Nenhuma mudanca detectada.</p>}
    </div>
  );
}
