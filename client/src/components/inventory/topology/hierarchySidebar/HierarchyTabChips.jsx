export default function HierarchyTabChips({ tabs, activeTabId, onSelectTab }) {
  if (!(tabs?.length > 1)) return null;
  return (
    <div className="network-topology-tab-chips" role="tablist" aria-label="Abas do inventário">
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTabId}
          className={tab.id === activeTabId ? "active" : ""}
          onClick={() => onSelectTab(tab.id)}
        >
          {tab.name}
        </button>
      ))}
    </div>
  );
}
