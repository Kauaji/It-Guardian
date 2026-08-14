export default function DashboardRankingList({ title, icon: Icon, items, loading, emptyMessage, renderItem, onSelectItem }) {
  return (
    <section className="panel dashboard-ranking-card">
      <div className="panel-heading">
        <h3>{title}</h3>
        {Icon && <Icon size={18} />}
      </div>
      {loading ? (
        <div className="dashboard-list-skeleton" aria-hidden="true" />
      ) : !items?.length ? (
        <p className="dashboard-empty-state">{emptyMessage}</p>
      ) : (
        <ol className="dashboard-ranking-list">
          {items.map((item, index) => (
            <li key={item.id || item.assetId || item.key || index}>
              {onSelectItem ? (
                <button type="button" className="dashboard-ranking-item clickable" onClick={() => onSelectItem(item)}>
                  {renderItem(item, index)}
                </button>
              ) : (
                <div className="dashboard-ranking-item">{renderItem(item, index)}</div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
