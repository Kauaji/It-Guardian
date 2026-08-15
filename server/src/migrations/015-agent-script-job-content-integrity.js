import { createHash } from "node:crypto";

function hashScriptContent(content) {
  return createHash("sha256").update(String(content || ""), "utf8").digest("hex");
}

export const migration015AgentScriptJobContentIntegrity = {
  id: "015-agent-script-job-content-integrity",
  async up(db) {
    await db(`
      ALTER TABLE agent_script_jobs
      ADD COLUMN IF NOT EXISTS content_hash TEXT;
    `);

    // Trabalhos ja enfileirados (status 'queued') nao tem hash ainda; sem isso a
    // verificacao de integridade em claimNextAgentScriptJob os recusaria por engano
    // na primeira execucao apos o deploy desta migracao.
    const pending = await db(`
      SELECT id, script_content
      FROM agent_script_jobs
      WHERE status = 'queued' AND content_hash IS NULL
    `);
    for (const row of pending.rows) {
      await db("UPDATE agent_script_jobs SET content_hash = $2 WHERE id = $1", [
        row.id,
        hashScriptContent(row.script_content)
      ]);
    }
  }
};
