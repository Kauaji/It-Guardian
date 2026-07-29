export const migration009AgentScriptAutomationLink = {
  id: "009-agent-script-automation-link",
  async up(db) {
    await db(`
      ALTER TABLE agent_script_jobs
      ADD COLUMN IF NOT EXISTS automation_run_id TEXT
      REFERENCES preventive_automation_runs(id) ON DELETE SET NULL;
    `);
  }
};
