import { query } from "../../database.js";
import { mergeAlertSettingsUpdate, normalizeAlertSettings } from "../../domain/alerts/alertConfiguration.js";

export async function getAlertSettings() {
  const result = await query("SELECT value FROM app_settings WHERE key = 'alert_settings' LIMIT 1");
  const current = result.rows[0]?.value || {};
  const normalized = normalizeAlertSettings(current);

  if (!result.rows.length) {
    await query(
      `
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('alert_settings', $1, NOW())
      `,
      [JSON.stringify(normalized)]
    );
  }

  return normalized;
}

export async function updateAlertSettings(payload = {}) {
  const current = await getAlertSettings();
  const normalized = mergeAlertSettingsUpdate(current, payload);

  await query(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('alert_settings', $1, NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = NOW()
    `,
    [JSON.stringify(normalized)]
  );

  return normalized;
}
