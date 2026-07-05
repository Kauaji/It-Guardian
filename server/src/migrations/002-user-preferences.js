export const migration002UserPreferences = {
  id: "002-user-preferences",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        preference_key TEXT NOT NULL,
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, preference_key)
      );
    `);
  }
};
