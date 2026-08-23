import { useHoverPopover } from "../../hooks/useHoverPopover.js";

const STATUS_MESSAGES = {
  online: "Maquina online",
  offline: "Maquina offline",
  problem: "Maquina com alerta/problema",
  unknown: "Sem dados recentes"
};

function formatFullDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function relativeSince(value) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const diffMinutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (diffMinutes < 1) return "Ha menos de 1 minuto";
  if (diffMinutes < 60) return `Ha ${diffMinutes} minuto${diffMinutes === 1 ? "" : "s"}`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Ha ${diffHours} hora${diffHours === 1 ? "" : "s"}`;
  const diffDays = Math.round(diffHours / 24);
  return `Ha ${diffDays} dia${diffDays === 1 ? "" : "s"}`;
}

/**
 * Reaproveita useHoverPopover (mesmo hook usado pelos indicadores de
 * metrica) - sem fetch novo, so le machine.lastSeenAt/status ja
 * disponiveis no objeto do device. Nunca inventa um timestamp quando
 * lastSeenAt e null.
 */
export default function StatusTooltip({ status, lastSeenAt, className = "", children }) {
  const { open, triggerProps, popoverProps } = useHoverPopover();
  const message = STATUS_MESSAGES[status] || STATUS_MESSAGES.unknown;
  const lastSeenLabel = formatFullDate(lastSeenAt);
  const relativeLabel = relativeSince(lastSeenAt);

  return (
    <span className={`status-tooltip-trigger ${className}`.trim()} tabIndex={0} {...triggerProps}>
      {children}
      {open && (
        <div className="status-tooltip-popover" role="dialog" aria-label={message} {...popoverProps}>
          <strong>{message}</strong>
          {lastSeenLabel ? (
            <>
              <p>Ultimo contato: {lastSeenLabel}</p>
              {relativeLabel && <p>{relativeLabel}</p>}
            </>
          ) : (
            <p>Sem historico de contato disponivel.</p>
          )}
        </div>
      )}
    </span>
  );
}
