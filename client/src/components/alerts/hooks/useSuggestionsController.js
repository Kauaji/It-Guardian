import useAlertSuggestions from "./useAlertSuggestions.js";
import useScriptLogDialog from "./useScriptLogDialog.js";
import useSuggestionScriptMenu from "./useSuggestionScriptMenu.js";

// Junta a lista de sugestoes, o menu de scripts e o modal de log, e monta as
// acoes dos cards (abrir detalhes/log fecha o menu de scripts aberto).
// `center` e o valor de useAlertCenterData().
export default function useSuggestionsController({
  center,
  token,
  devices,
  lookups,
  alertCorrelations,
  activeScripts,
  validationWindowMinutes
}) {
  const suggestionState = useAlertSuggestions({
    suggestions: center.suggestions,
    devices,
    statusFilter: center.suggestionStatusFilter,
    lookups,
    alertCorrelations
  });
  const scriptMenu = useSuggestionScriptMenu({
    token,
    activeScripts,
    lookups,
    validationWindowMinutes,
    onUseSuggestionScript: center.onUseSuggestionScript
  });
  const scriptLog = useScriptLogDialog({
    suggestions: center.suggestions,
    onApplyScriptLogSuggestedSolution: center.onApplyScriptLogSuggestedSolution,
    onAcknowledgeScriptLog: center.onAcknowledgeScriptLog,
    onCancelScriptValidation: center.onCancelScriptValidation
  });
  const actions = {
    onAccept: center.onAcceptSuggestion,
    onReject: center.onRejectSuggestion,
    onOpenInfo: (suggestionId) => {
      scriptMenu.closeMenu();
      suggestionState.openInfo(suggestionId);
    },
    onOpenLog: (validation) => {
      scriptMenu.closeMenu();
      scriptLog.openFromValidation(validation);
    }
  };

  return { ...suggestionState, scriptMenu, scriptLog, actions };
}
