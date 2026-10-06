import { useState } from "react";
import { fetchSuggestionRecommendedScripts } from "../../../api.js";
import { formatSuggestionCode } from "../alertUtils.js";
import { isHighRiskScript } from "../alertDisplayUtils.js";
import { hasRemoteAssistanceAgent, isRemoteAssistanceAssetFresh } from "../../remoteAssistance/remoteAssistanceModel.js";

// Menu "Scripts disponiveis" dos cards de sugestao: carrega recomendacoes sob
// demanda e envia o script para execucao via agente apos confirmacao.
export default function useSuggestionScriptMenu({ token, activeScripts, lookups, validationWindowMinutes, onUseSuggestionScript }) {
  const [openSuggestionId, setOpenSuggestionId] = useState(null);
  const [recommendationsBySuggestion, setRecommendationsBySuggestion] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [usingKey, setUsingKey] = useState("");

  async function toggleMenu(suggestionId) {
    setOpenSuggestionId((current) => (current === suggestionId ? null : suggestionId));

    if (openSuggestionId === suggestionId || recommendationsBySuggestion[suggestionId]?.recommended || loadingId === suggestionId) {
      return;
    }

    setLoadingId(suggestionId);
    try {
      const result = await fetchSuggestionRecommendedScripts(token, suggestionId);
      setRecommendationsBySuggestion((current) => ({
        ...current,
        [suggestionId]: {
          recommended: result?.recommended || [],
          others: result?.others || []
        }
      }));
    } catch (error) {
      setRecommendationsBySuggestion((current) => ({
        ...current,
        [suggestionId]: {
          recommended: [],
          others: activeScripts,
          error: activeScripts.length ? "" : error.message || "Não foi possível carregar os scripts."
        }
      }));
    } finally {
      setLoadingId(null);
    }
  }

  async function useScript(suggestion, script) {
    const scriptUseKey = `${suggestion.id}:${script.id}`;
    if (usingKey === scriptUseKey) return;
    const highRisk = isHighRiskScript(script);
    const device = lookups.findSuggestionDevice(suggestion);
    const agentActive = hasRemoteAssistanceAgent(device) && isRemoteAssistanceAssetFresh(device);

    if (!agentActive) {
      window.alert(
        "Esta máquina não possui um agente ativo no momento. A execução real não pode ser enviada enquanto o agente estiver offline ou desatualizado."
      );
      return;
    }

    const baseConfirmation =
      "Este script será executado de verdade na máquina selecionada pelo agente IT Guardian autenticado. " +
      "A execução ficará registrada no histórico do aviso e nos logs de auditoria. Deseja continuar?";
    if (!window.confirm(baseConfirmation)) return;

    if (highRisk) {
      const riskConfirmation =
        "Este script foi marcado como risco alto/crítico e exige aprovação de um segundo revisor com permissão " +
        "para aprovar execuções de risco elevado. Se você não tiver essa permissão, o envio será recusado pelo servidor. " +
        "Deseja continuar mesmo assim?";
      if (!window.confirm(riskConfirmation)) return;
    }

    setUsingKey(scriptUseKey);
    try {
      await onUseSuggestionScript(suggestion.id, script.id, {
        mode: "agent",
        confirmed: true,
        riskAcknowledged: highRisk,
        validationWindowMinutes,
        notes: `Script solicitado pelo card ${formatSuggestionCode(suggestion)} para execução via agente autenticado.`
      });
      setOpenSuggestionId(null);
    } finally {
      setUsingKey("");
    }
  }

  return {
    openSuggestionId,
    recommendationsBySuggestion,
    loadingId,
    usingKey,
    toggleMenu,
    useScript,
    closeMenu: () => setOpenSuggestionId(null)
  };
}
