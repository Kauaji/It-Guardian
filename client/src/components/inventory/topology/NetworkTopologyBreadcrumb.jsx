import { ChevronRight } from "lucide-react";

/**
 * `crumbs`: [{ label, onClick? }] - o ultimo item e a posicao atual (sem
 * onClick, nao clicavel); os anteriores levam de volta para aquele nivel.
 */
export default function NetworkTopologyBreadcrumb({ crumbs }) {
  if (!crumbs?.length) return null;

  return (
    <nav className="network-topology-breadcrumb" aria-label="Navegação da hierarquia do mapa de rede">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={`${crumb.label}-${index}`} className="network-topology-breadcrumb-item">
            {isLast || !crumb.onClick ? (
              <span className="is-current" aria-current="location">{crumb.label}</span>
            ) : (
              <button type="button" onClick={crumb.onClick}>{crumb.label}</button>
            )}
            {!isLast ? <ChevronRight size={14} className="network-topology-breadcrumb-separator" /> : null}
          </span>
        );
      })}
    </nav>
  );
}
