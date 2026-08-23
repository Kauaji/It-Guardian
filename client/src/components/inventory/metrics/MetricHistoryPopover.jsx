import { formatDate } from "../../../utils/display.js";

const METRIC_LABELS = { cpu: "CPU", ram: "RAM", disk: "Disco" };

/**
 * Relatorio basico do popover de hover - periodo fixo em 24h (pedido do
 * usuario). Nunca mostra uma metrica sem historico como 0/vazia - so a
 * mensagem explicita. `ref` como prop direta (React 19), sem forwardRef.
 */
export default function MetricHistoryPopover({ metric, data, loading, error, ref, ...popoverProps }) {
  const label = METRIC_LABELS[metric] || metric;

  return (
    <div ref={ref} className="metric-history-popover" role="dialog" aria-label={`Historico de ${label}`} {...popoverProps}>
      <strong>{label}</strong>
      {loading && <p className="metric-history-popover-status">Carregando historico...</p>}
      {!loading && error && <p className="metric-history-popover-status danger">{error}</p>}
      {!loading && !error && data?.summary && (
        <dl>
          <div><dt>Atual</dt><dd>{data.summary.current}%</dd></div>
          <div><dt>Media 24h</dt><dd>{data.summary.average}%</dd></div>
          <div><dt>Pico 24h</dt><dd>{data.summary.max}%</dd></div>
          <div><dt>Minimo 24h</dt><dd>{data.summary.min}%</dd></div>
          <div><dt>Amostras</dt><dd>{data.summary.samples}</dd></div>
          <div><dt>Ultima coleta</dt><dd>{formatDate(data.summary.lastCollectedAt)}</dd></div>
        </dl>
      )}
      {!loading && !error && data && !data.summary && (
        <p className="metric-history-popover-status">Sem historico suficiente para esta metrica.</p>
      )}
    </div>
  );
}
