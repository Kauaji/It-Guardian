import { getSystemSettingsDetails, updateSystemSettingsAndLog } from "../services/systemSettingsService.js";

export async function details(_req, res, next) {
  try {
    res.json({ settings: await getSystemSettingsDetails() });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const settings = await updateSystemSettingsAndLog(req.body, req.user);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
}
