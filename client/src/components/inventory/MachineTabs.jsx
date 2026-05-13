export default function MachineTabs({ activeTab, tabs, onChange }) {
  return (
    <nav className="machine-tabs" aria-label="Detalhes da maquina">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeTab === tab.id ? "active" : ""}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
