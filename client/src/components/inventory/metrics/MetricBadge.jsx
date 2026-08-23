import { useHoverPopover } from "../../../hooks/useHoverPopover.js";
import MetricHistoryPopover from "./MetricHistoryPopover.jsx";
import { useMetricHistory } from "./useMetricHistory.js";

const POPOVER_PERIOD = "24h";

/**
 * Embrulha (nunca substitui) o markup/classes ja existentes de CPU/RAM/Disco
 * no card - hover destaca e mostra o popover de historico, clique abre o
 * modal (via `onOpenModal`, cujo estado mora no `MachineCardContent`, nao
 * aqui). Botao real (nao span) para foco/teclado funcionarem sem trabalho
 * extra de ARIA.
 */
export default function MetricBadge({ metric, deviceId, token, onOpenModal, className = "", children }) {
  const { open, triggerProps, popoverProps, closeNow } = useHoverPopover();
  const { data, loading, error } = useMetricHistory({
    token,
    deviceId,
    metric,
    period: POPOVER_PERIOD,
    enabled: open
  });

  function handleClick(event) {
    event.stopPropagation();
    closeNow();
    onOpenModal(metric);
  }

  return (
    <button type="button" className={`metric-badge ${className}`.trim()} onClick={handleClick} {...triggerProps}>
      {children}
      {open && <MetricHistoryPopover metric={metric} data={data} loading={loading} error={error} {...popoverProps} />}
    </button>
  );
}
