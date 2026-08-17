import { addLog } from "../repositories/logRepository.js";
import { getSystemSettings, updateSystemSettings } from "../repositories/systemSettingsRepository.js";

export async function getSystemSettingsDetails() {
  return getSystemSettings();
}

export async function updateSystemSettingsAndLog(payload, user) {
  const settings = await updateSystemSettings(payload || {});

  await addLog({
    type: "system_settings",
    message: "System settings updated",
    userId: user.id,
    meta: { systemMode: settings.systemMode }
  });

  return settings;
}
