const tabs = [
  ["machines", "Máquinas"],
  ["plans", "Planos"],
  ["agenda", "Agenda"]
];

export default function AutomationManagementTabs({ value, onChange }) {
  function handleKeyDown(event) {
    const index = tabs.findIndex(([id]) => id === value);
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + direction + tabs.length) % tabs.length][0];
    onChange(next);
  }

  return (
    <div className="automation-management-tabs" role="tablist" aria-label="Visualização das automatizações" onKeyDown={handleKeyDown}>
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          tabIndex={value === id ? 0 : -1}
          className={value === id ? "active" : ""}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
