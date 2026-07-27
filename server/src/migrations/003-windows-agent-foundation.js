export const migration003WindowsAgentFoundation = {
  id: "003-windows-agent-foundation",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS agent_enrollments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        token_prefix TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ
      );
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS agent_assets (
        asset_id TEXT PRIMARY KEY,
        enrollment_id TEXT NOT NULL REFERENCES agent_enrollments(id) ON DELETE RESTRICT,
        hostname TEXT NOT NULL,
        machine_alias TEXT,
        operating_system TEXT NOT NULL,
        os_architecture TEXT NOT NULL,
        windows_version TEXT,
        local_ip TEXT,
        mac_address TEXT,
        cpu_model TEXT,
        memory_total_bytes BIGINT,
        disk_total_bytes BIGINT,
        disk_free_bytes BIGINT,
        uptime_seconds BIGINT,
        logged_user TEXT,
        agent_version TEXT NOT NULL,
        interval_seconds INTEGER NOT NULL DEFAULT 60,
        environment_name TEXT,
        group_name TEXT,
        segment_name TEXT,
        collected_at TIMESTAMPTZ NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS agent_heartbeats (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL REFERENCES agent_assets(asset_id) ON DELETE CASCADE,
        enrollment_id TEXT NOT NULL REFERENCES agent_enrollments(id) ON DELETE RESTRICT,
        collected_at TIMESTAMPTZ NOT NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        payload JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `);

    await db("CREATE INDEX IF NOT EXISTS idx_agent_assets_last_seen ON agent_assets(last_seen_at);");
    await db("CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_asset_received ON agent_heartbeats(asset_id, received_at);");
  }
};
