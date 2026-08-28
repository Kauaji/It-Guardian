/**
 * Mesma marcacao/classes de DashboardRankingList.jsx (dashboard-ranking-list/
 * -item, dashboard-empty-state) mas sem o <section>/panel-heading proprio --
 * dentro de um widget, o titulo ja vem do WidgetChrome, um segundo cabecalho
 * ficaria duplicado.
 */
export default function WidgetList({ items, emptyMessage, renderItem, onSelectItem, isSelected }) {
  if (!items?.length) {
    return <p className="dashboard-empty-state">{emptyMessage}</p>;
  }

  return (
    <ol className="dashboard-ranking-list">
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
