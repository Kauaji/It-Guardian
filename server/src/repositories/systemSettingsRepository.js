import { query } from "../database.js";

const systemSettingsKey = "system";

const defaultSystemSettings = {
  systemMode: "local"
};

function normalizeSystemMode(value) {
  return value === "business" ? "business" : "local";
}

function normalizeSystemSettings(value = {}) {
  return {
    systemMode: normalizeSystemMode(value.systemMode)
  };
}

export async function getSystemSettings() {
  const result = await query("SELECT value FROM app_settings WHERE key = $1", [systemSettingsKey]);
  return normalizeSystemSettings(result.rows[0]?.value || {});
}

export async function updateSystemSettings(payload = {}) {
  const current = await getSystemSettings();
  const normalized = normalizeSystemSettings({
    ...current,
    ...payload
  });

  const result = await query(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      RETURNING value
    `,
    [systemSettingsKey, JSON.stringify(normalized)]
  );

  return normalizeSystemSettings(result.rows[0]?.value || normalized);
}
