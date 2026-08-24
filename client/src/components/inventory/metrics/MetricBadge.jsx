/**
 * Embrulha (nunca substitui) o markup/classes ja existentes de CPU/RAM/Disco
 * no card - clique abre o modal de historico (via `onOpenModal`, cujo estado
 * mora no `MachineCardContent`, nao aqui). So expande com clique, nunca com
 * hover. Botao real (nao span) para foco/teclado funcionarem sem trabalho
 * extra de ARIA.
 */
export default function MetricBadge({ metric, onOpenModal, className = "", children }) {
  function handleClick(event) {
    event.stopPropagation();
    onOpenModal(metric);
  }

  return (
    <button type="button" className={`metric-badge ${className}`.trim()} onClick={handleClick}>
      {children}
    </button>
  );
}
