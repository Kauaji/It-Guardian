export const migration025ReportExports = {
  id: "025-report-exports",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS report_exports (
        id TEXT PRIMARY KEY,
        report_type TEXT NOT NULL,
        format TEXT NOT NULL DEFAULT 'csv',
        filters TEXT,
        requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        row_count INTEGER NOT NULL DEFAULT 0,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_report_exports_type_generated
      ON report_exports(report_type, generated_at);
    `);
  }
};
