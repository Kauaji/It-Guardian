import { ClipboardList } from "lucide-react";
import { useAlertCenterData } from "../../../context/AlertCenterContext.jsx";
import SuggestionCard from "./SuggestionCard.jsx";

// Painel "Sugestoes de OS": filtro por status e cards consolidados por maquina.
export default function SuggestionsPanel({ visibleSuggestions, priorityColorById, scriptMenu, actions }) {
  const { suggestionStatusFilter, setSuggestionStatusFilter } = useAlertCenterData();

  return (
    <section className="panel suggestions-panel">
      <div className="panel-heading">
        <div>
          <h2>Sugestões de OS</h2>
          <p>Aviso recorrente só vira Ordem de Serviço quando alguém aceita a sugestão.</p>
        </div>
        <ClipboardList size={18} />
      </div>
      <div className="toolbar inline-toolbar">
        <select value={suggestionStatusFilter} onChange={(event) => setSuggestionStatusFilter(event.target.value)}>
          <option value="all">Todas as sugestões</option>
          <option value="pending">Pendentes</option>
          <option value="observed_resolved">Observadas como normalizadas</option>
          <option value="observed_persistent">Observadas como persistentes</option>
          <option value="validation_cancelled">Observações canceladas</option>
        </select>
      </div>
      <div className="alert-board suggestion-board">
        {visibleSuggestions.map((suggestion, index) => (
          <SuggestionCard
            key={suggestion.aggregationKey || suggestion.id}
            suggestion={suggestion}
            index={index}
            priorityColor={priorityColorById[suggestion.suggestedPriority || "medium"] || priorityColorById.medium}
            scriptMenu={scriptMenu}
            actions={actions}
          />
        ))}
        {!visibleSuggestions.length && <p className="empty">Nenhuma sugestão encontrada para os filtros atuais.</p>}
      </div>
    </section>
  );
}
