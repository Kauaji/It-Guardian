import {
  createPreventiveAutomationPlan,
  deletePreventiveAutomationPlan,
  disablePreventiveAutomationPlan,
  fetchPreventiveAutomationAsset,
  reactivatePreventiveAutomationPlan,
  removeAssetFromPreventiveAutomationPlan,
  removePreventiveAutomationAssetOverride,
  savePreventiveAutomationAssetOverride,
  updatePreventiveAutomationPlan
} from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { useWorkspaceData } from "../context/workspaceContexts.js";

// Mensagem de sucesso ao salvar um plano: pausar/reativar tem texto proprio.
export function automationSaveMessage({ isUpdate, payload, previousPlan }) {
  const statusChanged = previousPlan && typeof payload?.active === "boolean" && previousPlan.active !== payload.active;
  if (statusChanged && payload.active === false) {
    return "Automação pausada. As agendas futuras foram desativadas.";
  }
  if (statusChanged && payload.active === true) {
    return "Automação reativada. As agendas foram recalculadas.";
  }
  return isUpdate ? "Automação preventiva atualizada." : "Automação preventiva criada.";
}

// Planos de automacao preventiva e a recorrencia por maquina.
export function usePreventiveAutomationActions() {
  const { token, notify } = useAppSession();
  const { loadData, preventiveAutomationPlans, setPreventiveAutomationPlans } = useWorkspaceData();

  function replacePlan(plan) {
    setPreventiveAutomationPlans((current) => current.map((item) => (item.id === plan.id ? plan : item)));
  }

  // Executa uma acao sobre o plano/maquina, avisa e recarrega; devolve o que
  // `pick` extrair da resposta e repassa o erro depois de notificar.
  async function runAndReload(action, successMessage, pick = () => undefined) {
    try {
      const response = await action();
      notify(successMessage, "ok");
      await loadData(true);
      return pick(response);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleSavePreventiveAutomationPlan(planId, payload) {
    try {
      const previousPlan = planId ? preventiveAutomationPlans.find((plan) => String(plan.id) === String(planId)) : null;
      const response = planId
        ? await updatePreventiveAutomationPlan(token, planId, payload)
        : await createPreventiveAutomationPlan(token, payload);
      setPreventiveAutomationPlans((current) => {
        const exists = current.some((plan) => plan.id === response.preventiveAutomationPlan.id);
        return exists
          ? current.map((plan) => (plan.id === response.preventiveAutomationPlan.id ? response.preventiveAutomationPlan : plan))
          : [response.preventiveAutomationPlan, ...current];
      });
      notify(automationSaveMessage({ isUpdate: Boolean(planId), payload, previousPlan }), "ok");
      await loadData(true);
      return response.preventiveAutomationPlan;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleDisablePreventiveAutomationPlan(planId) {
    try {
      const response = await disablePreventiveAutomationPlan(token, planId);
      replacePlan(response.preventiveAutomationPlan);
      notify("Automação preventiva pausada.", "ok");
      await loadData(true);
      return response.preventiveAutomationPlan;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleReactivatePreventiveAutomationPlan(planId) {
    try {
      const response = await reactivatePreventiveAutomationPlan(token, planId);
      replacePlan(response.preventiveAutomationPlan);
      notify("Automação preventiva reativada.", "ok");
      await loadData(true);
      return response.preventiveAutomationPlan;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  function handleDeletePreventiveAutomationPlan(planId) {
    return runAndReload(
      () => deletePreventiveAutomationPlan(token, planId),
      "Plano de automação excluído. Histórico e auditoria foram preservados."
    );
  }

  function handleSavePreventiveAutomationAssetOverride(planId, assetId, payload) {
    return runAndReload(
      () => savePreventiveAutomationAssetOverride(token, planId, assetId, payload),
      "Recorrência personalizada atualizada para esta máquina.",
      (response) => response.automationAsset
    );
  }

  function handleRemovePreventiveAutomationAssetOverride(planId, assetId) {
    return runAndReload(
      () => removePreventiveAutomationAssetOverride(token, planId, assetId),
      "A máquina voltou a usar a recorrência padrão do plano.",
      (response) => response.automationAsset
    );
  }

  function handleRemoveAssetFromPreventiveAutomationPlan(planId, assetId) {
    return runAndReload(
      () => removeAssetFromPreventiveAutomationPlan(token, planId, assetId),
      "Máquina removida do plano. Agendas futuras foram desativadas.",
      (response) => response
    );
  }

  async function handleFetchPreventiveAutomationAsset(planId, assetId) {
    const response = await fetchPreventiveAutomationAsset(token, planId, assetId);
    return response.automationAsset;
  }

  return {
    handleDeletePreventiveAutomationPlan,
    handleDisablePreventiveAutomationPlan,
    handleFetchPreventiveAutomationAsset,
    handleReactivatePreventiveAutomationPlan,
    handleRemoveAssetFromPreventiveAutomationPlan,
    handleRemovePreventiveAutomationAssetOverride,
    handleSavePreventiveAutomationAssetOverride,
    handleSavePreventiveAutomationPlan
  };
}
