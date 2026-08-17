import { badRequest } from "../lib/errors.js";
import {
  findUserPreference,
  upsertUserPreference
} from "../repositories/userPreferenceRepository.js";

const allowedKeys = new Set(["inventory-workspace"]);

function validateKey(key) {
  if (allowedKeys.has(key)) return;
  throw badRequest("Preferencia nao reconhecida.");
}

export async function getPreferenceForUser(userId, key) {
  validateKey(key);
  const preference = await findUserPreference(userId, key);
  return {
    key,
    value: preference?.value || null,
    updatedAt: preference?.updated_at || null
  };
}

export async function savePreferenceForUser(userId, key, value) {
  validateKey(key);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("O valor da preferencia deve ser um objeto.");
  }
  const preference = await upsertUserPreference(userId, key, value);
  return {
    key,
    value: preference.value,
    updatedAt: preference.updated_at
  };
}
