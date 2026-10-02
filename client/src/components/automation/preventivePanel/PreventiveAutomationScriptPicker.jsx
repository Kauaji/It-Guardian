export default function PreventiveAutomationScriptPicker({ scripts, selectedIds, onToggle }) {
  return (
    <section className="preventive-automation-scripts">
      <h3>Scripts/verificações</h3>
      <div>
        {scripts.map((script) => (
          <button
            key={script.id}
            type="button"
            className={selectedIds.includes(script.id) ? "selected" : ""}
            onClick={() => onToggle(script.id)}
          >
            <strong>{script.name}</strong>
            <small>{script.category || script.riskLevel || "Script cadastrado"}</small>
          </button>
        ))}
        {!scripts.length && <p className="empty">Nenhum script ativo cadastrado.</p>}
      </div>
    </section>
  );
}
