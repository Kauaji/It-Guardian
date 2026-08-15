export const migration016MaintenanceScriptContentAttribution = {
  id: "016-maintenance-script-content-attribution",
  async up(db) {
    await db(`
      ALTER TABLE maintenance_scripts
      ADD COLUMN IF NOT EXISTS content_updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;
    `);
    await db(`
      UPDATE maintenance_scripts
      SET content_updated_by = created_by
      WHERE content_updated_by IS NULL;
    `);
  }
};
