export const migration001RuntimeFoundation = {
  id: "001-runtime-foundation",
  async up(db) {
    await db(`
      CREATE INDEX IF NOT EXISTS idx_users_active_email
      ON users (active, lower(email));
    `);

    await db(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
      ON audit_logs (user_id, created_at DESC);
    `);

    await db(`
      CREATE INDEX IF NOT EXISTS idx_preventive_plan_assets_plan_status
      ON preventive_plan_assets (preventive_plan_id, status);
    `);
  }
};
