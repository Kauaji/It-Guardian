import { ChevronRight, FolderTree, Layers } from "lucide-react";
import { getAggregateStatusColorToken, getAggregateStatusLabel } from "./networkTopologyHierarchy.js";

/**
 * Grade de cards de resumo, reaproveitada tanto para o nivel Aba (itens =
 * grupos) quanto para o nivel Grupo (itens = segmentos) - um componente so,
 * parametrizado por `itemKind`, em vez de duas telas quase identicas.
 */
export default function NetworkTopologyAggregateGrid({ items, itemKind, onSelectItem }) {
  return (
    <div className="network-topology-aggregate-grid" role="list">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className="network-topology-aggregate-card"
          role="listitem"
          onClick={() => onSelectItem(item)}
          style={{ "--aggregate-status-color": getAggregateStatusColorToken(item.status) }}
        >
          <div className="network-topology-aggregate-card-header">
            <span className="network-topology-aggregate-card-icon">
              {itemKind === "group" ? <FolderTree size={18} /> : <Layers size={18} />}
            </span>
            <strong>{item.name}</strong>
            <ChevronRight size={16} className="network-topology-aggregate-card-chevron" />
          </div>
          <span className="network-topology-aggregate-card-status">{getAggregateStatusLabel(item.status)}</span>
          <div className="network-topology-aggregate-card-counts">
            {itemKind === "group" ? (
              <span>{item.segmentCount} segmento(s)</span>
            ) : null}
            <span>{item.deviceCount} ativo(s)</span>
            {item.onlineCount ? <span className="is-ok">{item.onlineCount} online</span> : null}
            {item.offlineCount ? <span className="is-warning">{item.offlineCount} offline</span> : null}
            {item.criticalCount ? <span className="is-danger">{item.criticalCount} crítico(s)</span> : null}
          </div>
        </button>
      ))}
    </div>
  );
}
