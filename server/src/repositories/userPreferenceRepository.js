import { query } from "../database.js";

export async function findUserPreference(userId, key) {
  const result = await query(
    "SELECT value, updated_at FROM user_preferences WHERE user_id = $1 AND preference_key = $2",
    [userId, key]
  );
  return result.rows[0] || null;
}

export async function upsertUserPreference(userId, key, value) {
  const result = await query(
    `
      INSERT INTO user_preferences (user_id, preference_key, value, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, preference_key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      RETURNING value, updated_at
    `,
    [userId, key, JSON.stringify(value ?? {})]
  );
  return result.rows[0];
}
