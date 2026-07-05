import {
  findUserPreference,
  upsertUserPreference
} from "../repositories/userPreferenceRepository.js";

const allowedKeys = new Set(["inventory-workspace"]);

function validateKey(key) {
  if (allowedKeys.has(key)) return;
  const error = new Error("Preferencia nao reconhecida.");
  error.statusCode = 400;
  throw error;
}

export async function getPreference(req, res, next) {
  try {
    validateKey(req.params.key);
    const preference = await findUserPreference(req.user.id, req.params.key);
    res.json({
      key: req.params.key,
      value: preference?.value || null,
      updatedAt: preference?.updated_at || null
    });
  } catch (error) {
    next(error);
  }
}

export async function savePreference(req, res, next) {
  try {
    validateKey(req.params.key);
    if (!req.body || typeof req.body.value !== "object" || Array.isArray(req.body.value)) {
      return res.status(400).json({ message: "O valor da preferencia deve ser um objeto." });
    }
    const preference = await upsertUserPreference(req.user.id, req.params.key, req.body.value);
    res.json({
      key: req.params.key,
      value: preference.value,
      updatedAt: preference.updated_at
    });
  } catch (error) {
    next(error);
  }
}
