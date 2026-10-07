import AlertsCompactPanel from "./AlertsCompactPanel.jsx";
import SuggestionsPanel from "./SuggestionsPanel.jsx";

// Aba "Sugestoes de OS": lista de sugestoes ao lado do resumo de avisos.
export default function SuggestionsTab({ visibleSuggestions, visibleAlerts, priorityColorById, scriptMenu, actions }) {
  return (
    <section className="alerts-workspace-grid">
      <SuggestionsPanel
        visibleSuggestions={visibleSuggestions}
        priorityColorById={priorityColorById}
        scriptMenu={scriptMenu}
        actions={actions}
      />
      <AlertsCompactPanel visibleAlerts={visibleAlerts} />
    </section>
  );
}
