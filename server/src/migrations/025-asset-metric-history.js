export const migration025AssetMetricHistory = {
  id: "025-asset-metric-history",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS asset_metric_history (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL REFERENCES agent_assets(asset_id) ON DELETE CASCADE,
        source TEXT NOT NULL DEFAULT 'agent',
        cpu_usage_percent INTEGER,
        memory_usage_percent INTEGER,
        memory_used_bytes BIGINT,
        memory_total_bytes BIGINT,
        disk_usage_percent INTEGER,
        disk_used_bytes BIGINT,
        disk_total_bytes BIGINT,
        collected_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_asset_metric_history_asset_collected
      ON asset_metric_history(asset_id, collected_at);
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_asset_metric_history_collected
      ON asset_metric_history(collected_at);
    `);
  }
};
