import { addLog } from "../repositories/logRepository.js";
import { getSystemSettings, updateSystemSettings } from "../repositories/systemSettingsRepository.js";

export async function details(_req, res, next) {
  try {
    res.json({ settings: await getSystemSettings() });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const settings = await updateSystemSettings(req.body || {});

    await addLog({
      type: "system_settings",
      message: "System settings updated",
      userId: req.user.id,
      meta: { systemMode: settings.systemMode }
    });

    res.json({ settings });
  } catch (error) {
    next(error);
  }
}
