import { useMemo, useState } from "react";
import { buildSuggestionInfoModel, buildVisibleSuggestions, findSuggestionCodeIndex } from "../alertViewModel.js";

// Lista de sugestoes visiveis (consolidadas por maquina) e o modal de detalhes.
export default function useAlertSuggestions({ suggestions, devices, statusFilter, lookups, alertCorrelations }) {
  const [selectedInfoId, setSelectedInfoId] = useState(null);
  const visibleSuggestions = useMemo(
    () => buildVisibleSuggestions(suggestions, devices, statusFilter),
    [suggestions, devices, statusFilter]
  );
  const selectedSuggestion = suggestions.find((suggestion) => suggestion.id === selectedInfoId) || null;

  return {
    visibleSuggestions,
    selectedSuggestion,
    selectedModel: buildSuggestionInfoModel(selectedSuggestion, lookups, alertCorrelations),
    selectedIndex: findSuggestionCodeIndex(visibleSuggestions, suggestions, selectedInfoId),
    openInfo: setSelectedInfoId,
    closeInfo: () => setSelectedInfoId(null)
  };
}
