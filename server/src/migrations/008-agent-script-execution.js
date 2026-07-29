export const migration008AgentScriptExecution = {
  id: "008-agent-script-execution",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS agent_script_jobs (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL REFERENCES agent_assets(asset_id) ON DELETE CASCADE,
        enrollment_id TEXT NOT NULL REFERENCES agent_enrollments(id) ON DELETE RESTRICT,
        script_id TEXT NOT NULL REFERENCES maintenance_scripts(id) ON DELETE RESTRICT,
        execution_log_id TEXT NOT NULL UNIQUE REFERENCES script_execution_logs(id) ON DELETE CASCADE,
        validation_id TEXT REFERENCES script_validation_runs(id) ON DELETE SET NULL,
        automation_run_id TEXT REFERENCES preventive_automation_runs(id) ON DELETE SET NULL,
        script_type TEXT NOT NULL,
        script_content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        timeout_seconds INTEGER NOT NULL DEFAULT 120,
        requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        claimed_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        exit_code INTEGER,
        timed_out BOOLEAN NOT NULL DEFAULT FALSE,
        stdout TEXT,
        stderr TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_agent_script_jobs_asset_status
      ON agent_script_jobs(asset_id, status, created_at);
    `);
  }
};
