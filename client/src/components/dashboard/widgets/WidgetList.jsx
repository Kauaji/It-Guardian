/**
 * Mesma marcacao/classes de DashboardRankingList.jsx (dashboard-ranking-list/
 * -item, dashboard-empty-state) mas sem o <section>/panel-heading proprio --
 * dentro de um widget, o titulo ja vem do WidgetChrome, um segundo cabecalho
 * ficaria duplicado.
 */
import { useScrollableTabIndex } from "../../../hooks/useScrollableTabIndex.js";

export default function WidgetList({ items, emptyMessage, renderItem, onSelectItem, isSelected, label = "Lista de itens" }) {
  const scroll = useScrollableTabIndex();
  if (!items?.length) {
    return <p className="dashboard-empty-state">{emptyMessage}</p>;
  }

  return (
    <ol ref={scroll.ref} className="dashboard-ranking-list" tabIndex={scroll.tabIndex} aria-label={scroll.scrollable ? label : undefined}>
      {items.map((item, index) => (
        <li key={item.id || item.assetId || item.key || index}>
          {onSelectItem ? (
            <button type="button" className="dashboard-ranking-item clickable" aria-pressed={isSelected?.(item)} onClick={() => onSelectItem(item)}>
              {renderItem(item, index)}
            </button>
          ) : (
            <div className="dashboard-ranking-item">{renderItem(item, index)}</div>
          )}
        </li>
      ))}
    </ol>
  );
}
