import { addLog } from "../repositories/logRepository.js";
import { getSystemSettings, updateSystemSettings } from "../repositories/systemSettingsRepository.js";
import { isRemoteScriptExecutionEnabled } from "../config/environment.js";

export async function getSystemSettingsDetails() {
  const settings = await getSystemSettings();
  // Computado a partir da variavel de ambiente, nunca persistido - o
  // cliente ja busca este endpoint no carregamento (usado hoje pra
  // systemMode), entao a flag real do servidor fica disponivel sem
  // exigir rebuild do frontend (diferente do flag de build-time
  // VITE_ENABLE_REMOTE_SCRIPT_EXECUTION, que so muda com um novo build).
  return { ...settings, remoteScriptExecutionEnabled: isRemoteScriptExecutionEnabled() };
}

export async function updateSystemSettingsAndLog(payload, user) {
  const settings = await updateSystemSettings(payload || {});

  await addLog({
    type: "system_settings",
    message: "System settings updated",
    userId: user.id,
    meta: { systemMode: settings.systemMode }
  });

  return { ...settings, remoteScriptExecutionEnabled: isRemoteScriptExecutionEnabled() };
}
