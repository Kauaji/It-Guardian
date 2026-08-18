export const migration019RemoteAssistanceEventsAssetIndex = {
  id: "019-remote-assistance-events-asset-index",
  async up(db) {
    await db(`
      CREATE INDEX IF NOT EXISTS idx_remote_assistance_events_asset
      ON remote_assistance_events(asset_id, created_at DESC);
    `);
  }
};
