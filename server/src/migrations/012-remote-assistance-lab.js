export const migration012RemoteAssistanceLab = {
  id: "012-remote-assistance-lab",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS security_reauthentications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        asset_id TEXT,
        service_order_id TEXT REFERENCES service_orders(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`
      CREATE TABLE IF NOT EXISTS security_reauthentication_attempts (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        asset_id TEXT,
        service_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
        succeeded BOOLEAN NOT NULL DEFAULT FALSE,
        request_ip TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_security_reauth_user_action
      ON security_reauthentications(user_id, action, expires_at);
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS remote_assistance_sessions (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL REFERENCES agent_assets(asset_id) ON DELETE CASCADE,
        service_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
        technician_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        technician_name TEXT,
        reauth_id TEXT REFERENCES security_reauthentications(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'requested',
        requested_mode TEXT NOT NULL DEFAULT 'view',
        control_consent_granted BOOLEAN NOT NULL DEFAULT FALSE,
        remote_control_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        privacy_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        admin_actions_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        consent_required BOOLEAN NOT NULL DEFAULT TRUE,
        consent_status TEXT NOT NULL DEFAULT 'pending',
        consent_requested_at TIMESTAMPTZ,
        consent_responded_at TIMESTAMPTZ,
        selected_monitor_id TEXT,
        monitor_count INTEGER NOT NULL DEFAULT 0,
        viewer_token_hash TEXT NOT NULL UNIQUE,
        agent_token_hash TEXT NOT NULL UNIQUE,
        reason TEXT NOT NULL,
        environment_name TEXT NOT NULL,
        connection_mode TEXT NOT NULL DEFAULT 'snapshot_polling',
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        last_seen_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        end_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_remote_assistance_asset_status
      ON remote_assistance_sessions(asset_id, status, created_at);
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_remote_assistance_expiry
      ON remote_assistance_sessions(status, expires_at);
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS remote_assistance_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES remote_assistance_sessions(id) ON DELETE CASCADE,
        asset_id TEXT NOT NULL,
        service_order_id TEXT,
        actor_type TEXT NOT NULL,
        actor_user_id TEXT,
        actor_name TEXT,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_remote_assistance_events_session
      ON remote_assistance_events(session_id, created_at);
    `);
  }
};
