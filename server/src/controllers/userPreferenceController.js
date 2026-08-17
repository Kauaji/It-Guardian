import { getPreferenceForUser, savePreferenceForUser } from "../services/userPreferenceService.js";

export async function getPreference(req, res, next) {
  try {
    const preference = await getPreferenceForUser(req.user.id, req.params.key);
    res.json(preference);
  } catch (error) {
    next(error);
  }
}

export async function savePreference(req, res, next) {
  try {
    const preference = await savePreferenceForUser(req.user.id, req.params.key, req.body?.value);
    res.json(preference);
  } catch (error) {
    next(error);
  }
}
