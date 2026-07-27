export const migration004ExternalIntegrations = {
  id: "004-external-integrations",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS integration_sync_state (
        source TEXT PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        mode TEXT NOT NULL DEFAULT 'disabled',
        base_url TEXT,
        last_status TEXT NOT NULL DEFAULT 'never_synced',
        last_sync_at TIMESTAMPTZ,
        last_error TEXT,
        imported_assets INTEGER NOT NULL DEFAULT 0,
        imported_alerts INTEGER NOT NULL DEFAULT 0,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS integration_assets (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        hostname TEXT,
        display_name TEXT NOT NULL,
        ip TEXT,
        serial_number TEXT,
        asset_tag TEXT,
        mac_address TEXT,
        manufacturer TEXT,
        model TEXT,
        operating_system TEXT,
        status TEXT NOT NULL DEFAULT 'unknown',
        metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
        hardware JSONB NOT NULL DEFAULT '{}'::jsonb,
        correlation JSONB NOT NULL DEFAULT '{}'::jsonb,
        raw_data JSONB,
        collected_at TIMESTAMPTZ NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (source, external_id)
      );
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS integration_alerts (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        asset_external_id TEXT,
        asset_hostname TEXT,
        name TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL,
        resolved_at TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        raw_data JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (source, external_id)
      );
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS integration_conflicts (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        candidate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
        resolved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (source, external_id)
      );
    `);

    await db("CREATE INDEX IF NOT EXISTS idx_integration_assets_hostname ON integration_assets(hostname);");
    await db("CREATE INDEX IF NOT EXISTS idx_integration_assets_ip ON integration_assets(ip);");
    await db("CREATE INDEX IF NOT EXISTS idx_integration_assets_serial ON integration_assets(serial_number);");
    await db("CREATE INDEX IF NOT EXISTS idx_integration_alerts_status ON integration_alerts(source, status, occurred_at);");
    await db("CREATE INDEX IF NOT EXISTS idx_integration_conflicts_open ON integration_conflicts(source, resolved);");
  }
};
