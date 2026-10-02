import {
  acceptServiceOrderSuggestion,
  createAlertComment,
  evaluateAlerts,
  fetchAlertCorrelations,
  rejectServiceOrderSuggestion,
  updateAlertRule,
  updateAlertSettings
} from "../../api.js";
import { normalizePrioritySettings } from "../../components/alerts/alertUtils.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { useWorkspaceData } from "../context/workspaceContexts.js";

// Acoes da central de Avisos: reavaliar, sugestoes de OS, comentarios,
// regras e prioridades.
export function useAlertActions() {
  const { token, notify } = useAppSession();
  const {
    loadData,
    setAlertCorrelations,
    setAlertPriorityColors,
    setAlertPrioritySettings,
    setAlertRules,
    setAlerts,
    setServiceOrderSuggestions
  } = useWorkspaceData();

  async function handleEvaluateAlerts() {
    try {
      const result = await evaluateAlerts(token);
      setAlerts(result.alerts || []);
      setAlertRules(result.rules || []);
      setServiceOrderSuggestions(result.suggestions || []);
      const correlationData = await fetchAlertCorrelations(token).catch(() => ({ correlations: [] }));
      setAlertCorrelations(correlationData.correlations || []);
      const created = result.createdSuggestions?.length || 0;
      notify(
        created
          ? `${created} sugestão(ões) de OS criada(s) a partir dos avisos.`
          : "Avisos avaliados. Nenhuma nova sugestão foi necessária.",
        "ok"
      );
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleAcceptSuggestion(suggestionId) {
    try {
      const result = await acceptServiceOrderSuggestion(token, suggestionId);
      const serviceOrder = result.serviceOrder;

      setServiceOrderSuggestions((current) => current.filter((suggestion) => suggestion.id !== suggestionId));

      notify(`OS criada a partir do aviso: ${serviceOrder?.number || "registrada"}.`, "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleAddAlertComment(alertId, message) {
    try {
      await createAlertComment(token, alertId, message);
      notify("Comentário registrado no aviso.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleRejectSuggestion(suggestionId) {
    const reason = "Recusado pelo painel de avisos.";
    try {
      await rejectServiceOrderSuggestion(token, suggestionId, reason);
      setServiceOrderSuggestions((current) => current.filter((suggestion) => suggestion.id !== suggestionId));
      notify("Sugestão de OS recusada.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleUpdateAlertRule(ruleId, payload) {
    try {
      const response = await updateAlertRule(token, ruleId, payload);
      setAlertRules((current) =>
        current.map((rule) => (rule.id === ruleId ? response.rule : rule))
      );
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleSaveAlertPrioritySettings(settings) {
    try {
      const response = await updateAlertSettings(token, settings);
      const nextPrioritySettings = normalizePrioritySettings(response.settings);
      setAlertPrioritySettings(nextPrioritySettings);
      setAlertPriorityColors(nextPrioritySettings.priorityColors);
      notify("Configurações de prioridade dos avisos salvas.", "ok");
      return nextPrioritySettings;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  return {
    handleAcceptSuggestion,
    handleAddAlertComment,
    handleEvaluateAlerts,
    handleRejectSuggestion,
    handleSaveAlertPrioritySettings,
    handleUpdateAlertRule
  };
}
