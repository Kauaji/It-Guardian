import {
  acknowledgeScriptLog,
  analyzeMaintenanceScript,
  applyScriptLogSuggestedSolution,
  cancelScriptValidation,
  createMaintenanceScript,
  deleteMaintenanceScript,
  registerMaintenanceScriptSimulation,
  updateMaintenanceScript,
  useSuggestionScript as executeSuggestionScript
} from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { useWorkspaceData } from "../context/workspaceContexts.js";

// Scripts de manutencao e seus registros: cadastro, analise, simulacao e
// revisao de logs. Nenhum comando e executado pelo navegador.
export function useMaintenanceScriptActions() {
  const { token, notify } = useAppSession();
  const { loadData, remoteScriptExecutionEnabled, setMaintenanceScripts } = useWorkspaceData();

  // Executa `action`, notifica o sucesso e repassa o erro (apos notificar).
  async function runAndReload(action, successMessage) {
    try {
      await action();
      notify(successMessage, "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleAnalyzeMaintenanceScript(payload) {
    try {
      const response = await analyzeMaintenanceScript(token, payload);
      notify("Resumo estimado gerado. Revise manualmente antes de salvar.", "ok");
      return response.analysis;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleSaveMaintenanceScript(payload, scriptId = null) {
    try {
      const response = scriptId
        ? await updateMaintenanceScript(token, scriptId, payload)
        : await createMaintenanceScript(token, payload);
      setMaintenanceScripts((current) => {
        const exists = current.some((script) => script.id === response.script.id);
        return exists
          ? current.map((script) => (script.id === response.script.id ? response.script : script))
          : [response.script, ...current];
      });
      notify(scriptId ? "Script de manutenção atualizado." : "Script de manutenção cadastrado.", "ok");
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleDeactivateMaintenanceScript(scriptId) {
    try {
      const response = await deleteMaintenanceScript(token, scriptId);
      setMaintenanceScripts((current) =>
        current.map((script) => (script.id === response.script.id ? response.script : script))
      );
      notify("Script de manutenção desativado.", "ok");
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  function handleRegisterMaintenanceScriptSimulation(scriptId, payload) {
    return runAndReload(
      () => registerMaintenanceScriptSimulation(token, scriptId, payload),
      "Registro criado. Nenhum comando foi executado."
    );
  }

  async function handleUseSuggestionScript(suggestionId, scriptId, payload) {
    if (!remoteScriptExecutionEnabled) {
      notify("Execução remota desabilitada. Use o registro em modo de simulação.", "warning");
      return;
    }
    await runAndReload(
      () => executeSuggestionScript(token, suggestionId, scriptId, payload),
      "Script enfileirado. Aguardando execução pelo agente da máquina."
    );
  }

  function handleAcknowledgeScriptLog(logId) {
    return runAndReload(() => acknowledgeScriptLog(token, logId), "Log marcado como revisado.");
  }

  function handleApplyScriptLogSuggestedSolution(logId, payload) {
    return runAndReload(
      () => applyScriptLogSuggestedSolution(token, logId, payload),
      "Ação corretiva registrada. Nenhum comando foi executado."
    );
  }

  function handleCancelScriptValidation(validationId) {
    return runAndReload(() => cancelScriptValidation(token, validationId), "Observação cancelada.");
  }

  return {
    handleAcknowledgeScriptLog,
    handleAnalyzeMaintenanceScript,
    handleApplyScriptLogSuggestedSolution,
    handleCancelScriptValidation,
    handleDeactivateMaintenanceScript,
    handleRegisterMaintenanceScriptSimulation,
    handleSaveMaintenanceScript,
    handleUseSuggestionScript
  };
}
