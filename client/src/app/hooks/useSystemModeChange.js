import { updateSystemSettings } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { useWorkspaceData } from "../context/workspaceContexts.js";

// Troca o modo do sistema (Local/Business) de forma otimista: aplica na hora
// e volta ao modo anterior se o servidor recusar.
export function useSystemModeChange() {
  const { token, notify } = useAppSession();
  const { setSystemMode, systemMode } = useWorkspaceData();

  return async function changeSystemMode(mode) {
    const nextMode = mode === "business" ? "business" : "local";
    setSystemMode(nextMode);

    try {
      const response = await updateSystemSettings(token, { systemMode: nextMode });
      const savedMode = response.settings?.systemMode === "business" ? "business" : "local";
      setSystemMode(savedMode);
      notify(savedMode === "business" ? "Modo Business ativado." : "Modo Local ativado.", "ok");
    } catch (error) {
      setSystemMode(systemMode);
      notify(error.message, "danger");
    }
  };
}
