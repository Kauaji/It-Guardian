import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "agent-script-job-lifecycle-secret-with-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { createAgentEnrollment, revokeAgentEnrollment } = await import("../src/repositories/agentRepository.js");
const {
  claimNextAgentScriptJob,
  completeAgentScriptJob,
  queueAgentScriptJob
} = await import("../src/services/agentScriptJobService.js");
const {
  createMaintenanceScript,
  createScriptSimulationLog
} = await import("../src/services/maintenanceScripts/maintenanceScriptsFacade.js");
const { agentHeaders, listen, sendHeartbeat } = await import("../test-support/scriptFixtures.mjs");

test.after(closeDatabase);

async function startServer(t) {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

async function enroll(baseUrl, machineId) {
  const enrollment = await createAgentEnrollment({ name: `Agente ${machineId}` });
  const { response } = await sendHeartbeat(baseUrl, enrollment.token, machineId);
  assert.equal(response.status, 202);
  return { token: enrollment.token, enrollmentId: enrollment.enrollment.id, machineId };
}

let scriptCounter = 0;
async function newScript(overrides = {}) {
  scriptCounter += 1;
  return createMaintenanceScript({
    name: `Script de job ${scriptCounter}`,
    type: "powershell",
    content: `Write-Output 'job ${scriptCounter}'`,
    riskLevel: "low",
    ...overrides
  });
}

async function queueJob({ machineId, script, logOverrides = {}, queueOverrides = {} }) {
  const targetScript = script || (await newScript());
  const log = await createScriptSimulationLog({
    scriptId: targetScript.id,
    assetId: machineId,
    mode: "agent",
    status: "queued",
    rawLog: "Aguardando entrega.",
    parsedSummary: "Enfileirado.",
    ...logOverrides
  });
  const job = await queueAgentScriptJob({
    script: targetScript,
    assetId: machineId,
    executionLogId: log.id,
    ...queueOverrides
  });
  return { script: targetScript, log, job };
}

async function deliver(agent) {
  return claimNextAgentScriptJob({ assetId: agent.machineId, enrollmentId: agent.enrollmentId });
}

async function postResult(baseUrl, token, jobId, body) {
  const response = await fetch(`${baseUrl}/api/agents/jobs/${jobId}/result`, {
    method: "POST",
    headers: agentHeaders(token),
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

test("fila recusa script invalido, sem conteudo, sem agente ativo e limita o timeout", async (t) => {
  const baseUrl = await startServer(t);
  const agent = await enroll(baseUrl, "job-queue-validation");
  const script = await newScript();
  const log = await createScriptSimulationLog({ scriptId: script.id, assetId: agent.machineId, mode: "agent", status: "queued" });
  const base = { assetId: agent.machineId, executionLogId: log.id };

  await assert.rejects(queueAgentScriptJob({ ...base, script: null }), (error) => error.statusCode === 400);
  await assert.rejects(
    queueAgentScriptJob({ ...base, script: { ...script, type: "shell" } }),
    (error) => error.statusCode === 400 && /BAT, CMD e PowerShell/.test(error.message)
  );
  await assert.rejects(
    queueAgentScriptJob({ ...base, script: { ...script, type: "other" } }),
    (error) => error.statusCode === 400
  );
  await assert.rejects(
    queueAgentScriptJob({ ...base, script: { ...script, content: "   " } }),
    (error) => error.statusCode === 400 && /nao possui conteudo executavel/.test(error.message)
  );
  await assert.rejects(
    queueAgentScriptJob({ ...base, script, assetId: "maquina-sem-agente" }),
    (error) => error.statusCode === 409 && /nao possui um agente ativo/.test(error.message)
  );

  const jobs = await query("SELECT COUNT(*)::INTEGER AS total FROM agent_script_jobs WHERE asset_id = $1", [agent.machineId]);
  assert.equal(jobs.rows[0].total, 0);

  const expectations = [
    [undefined, 120],
    [1, 15],
    [5000, 600],
    [90, 90],
    [45.6, 46]
  ];
  for (const [input, expected] of expectations) {
    const queued = await queueJob({ machineId: agent.machineId, script, queueOverrides: { timeoutSeconds: input } });
    assert.equal(queued.job.timeoutSeconds, expected, `timeout ${input}`);
    const claimed = await deliver(agent);
    assert.equal(claimed.timeoutSeconds, expected);
    await completeAgentScriptJob({
      jobId: claimed.id,
      enrollmentId: agent.enrollmentId,
      result: { exitCode: 0, stdout: "", stderr: "", errorMessage: "", timedOut: false }
    });
  }

  const upper = await queueJob({ machineId: agent.machineId, script: { ...script, type: "POWERSHELL" } });
  const stored = await query("SELECT script_type, content_hash, script_content FROM agent_script_jobs WHERE id = $1", [upper.job.id]);
  assert.equal(stored.rows[0].script_type, "powershell");
  assert.equal(stored.rows[0].content_hash, createHash("sha256").update(script.content, "utf8").digest("hex"));
  assert.equal(stored.rows[0].script_content, script.content);

  await revokeAgentEnrollment(agent.enrollmentId);
  await assert.rejects(
    queueJob({ machineId: agent.machineId, script }),
    (error) => error.statusCode === 409,
    "enrollment revogado deixa a maquina sem agente ativo"
  );
});

test("entrega respeita a flag do servidor, a ordem de chegada, a maquina e o enrollment", async (t) => {
  const baseUrl = await startServer(t);
  const agentA = await enroll(baseUrl, "job-claim-a");
  const agentB = await enroll(baseUrl, "job-claim-b");
  const adminScript = await newScript({ requiresAdmin: true, requiresLoggedUser: true, name: "Script com requisitos" });

  const first = await queueJob({ machineId: agentA.machineId, script: adminScript });
  const second = await queueJob({ machineId: agentA.machineId });
  const forB = await queueJob({ machineId: agentB.machineId });

  process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "false";
  try {
    assert.equal(await deliver(agentA), null, "com a execucao remota desligada nada e entregue");
    const heartbeat = await sendHeartbeat(baseUrl, agentA.token, agentA.machineId);
    assert.equal(heartbeat.body.remoteScriptExecutionEnabled, false);
    assert.equal(heartbeat.body.job, null);
  } finally {
    process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
  }
  const stillQueued = await query("SELECT status FROM agent_script_jobs WHERE id = $1", [first.job.id]);
  assert.equal(stillQueued.rows[0].status, "queued");

  assert.equal(
    await claimNextAgentScriptJob({ assetId: agentA.machineId, enrollmentId: agentB.enrollmentId }),
    null,
    "outro enrollment nao recebe o trabalho da maquina"
  );

  const claimedFirst = await deliver(agentA);
  assert.equal(claimedFirst.id, first.job.id, "entrega na ordem de enfileiramento");
  assert.deepEqual(
    { name: claimedFirst.name, type: claimedFirst.type, content: claimedFirst.content, requiresAdmin: claimedFirst.requiresAdmin, requiresLoggedUser: claimedFirst.requiresLoggedUser },
    { name: "Script com requisitos", type: "powershell", content: adminScript.content, requiresAdmin: true, requiresLoggedUser: true }
  );
  assert.equal(claimedFirst.scriptId, adminScript.id);
  const claimedRow = await query("SELECT status, claimed_at FROM agent_script_jobs WHERE id = $1", [first.job.id]);
  assert.equal(claimedRow.rows[0].status, "claimed");
  assert.ok(claimedRow.rows[0].claimed_at);

  const claimedSecond = await deliver(agentA);
  assert.equal(claimedSecond.id, second.job.id);
  assert.equal(claimedSecond.requiresAdmin, false);
  assert.equal(await deliver(agentA), null, "fila vazia devolve null");

  const claimedForB = await deliver(agentB);
  assert.equal(claimedForB.id, forB.job.id);
});

test("trabalho adulterado ou desativado e recusado e encerra a observacao vinculada", async (t) => {
  const baseUrl = await startServer(t);
  const agent = await enroll(baseUrl, "job-tamper-validation");
  const script = await newScript();
  const { log, job } = await queueJob({ machineId: agent.machineId, script });

  const validationId = randomUUID();
  await query(
    `
      INSERT INTO script_validation_runs (id, asset_id, script_id, status, validation_due_at, active_key, log_id)
      VALUES ($1, $2, $3, 'waiting_agent', $4, $5, $6)
    `,
    [validationId, agent.machineId, script.id, new Date(Date.now() + 3600_000).toISOString(), `tamper:${validationId}`, log.id]
  );
  await query("UPDATE agent_script_jobs SET validation_id = $2 WHERE id = $1", [job.id, validationId]);
  await query("UPDATE maintenance_scripts SET content = $2 WHERE id = $1", [script.id, "Write-Output 'conteudo trocado'"]);

  assert.equal(await deliver(agent), null);

  const jobRow = await query("SELECT status, completed_at, error_message FROM agent_script_jobs WHERE id = $1", [job.id]);
  assert.equal(jobRow.rows[0].status, "failed");
  assert.ok(jobRow.rows[0].completed_at);
  assert.match(jobRow.rows[0].error_message, /Nenhum comando foi enviado ao agente/);
  const validationRow = await query(
    "SELECT status, finished_at, active_key, result_summary FROM script_validation_runs WHERE id = $1",
    [validationId]
  );
  assert.equal(validationRow.rows[0].status, "execution_failed");
  assert.equal(validationRow.rows[0].active_key, null);
  assert.ok(validationRow.rows[0].finished_at);
  assert.match(validationRow.rows[0].result_summary, /conteudo do script cadastrado mudou/);
  const audit = await query("SELECT meta FROM audit_logs WHERE type = 'agent_script_execution_content_mismatch'");
  assert.ok(audit.rows.some((row) => row.meta.jobId === job.id));

  const second = await queueJob({ machineId: agent.machineId });
  assert.ok(await deliver(agent), "um trabalho integro continua sendo entregue depois da recusa");
  assert.ok(second.job.id);
});

test("resultado do agente: autenticacao, escopo, estados e idempotencia", async (t) => {
  const baseUrl = await startServer(t);
  const agent = await enroll(baseUrl, "job-result-scope");
  const other = await enroll(baseUrl, "job-result-other");
  const { job, log } = await queueJob({ machineId: agent.machineId });

  const noToken = await fetch(`${baseUrl}/api/agents/jobs/${job.id}/result`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ exitCode: 0 })
  });
  assert.equal(noToken.status, 401);
  assert.equal((await postResult(baseUrl, "itg_token_invalido", job.id, { exitCode: 0 })).response.status, 401);

  const unknown = await postResult(baseUrl, agent.token, "job-inexistente", { exitCode: 0 });
  assert.equal(unknown.response.status, 404);

  const notClaimed = await postResult(baseUrl, agent.token, job.id, { exitCode: 0 });
  assert.equal(notClaimed.response.status, 409, "trabalho ainda na fila nao aceita resultado");
  assert.match(notClaimed.body.message, /ainda nao foi entregue/);

  const claimed = await deliver(agent);
  assert.equal(claimed.id, job.id);

  const wrongEnrollment = await postResult(baseUrl, other.token, job.id, { exitCode: 0 });
  assert.equal(wrongEnrollment.response.status, 404, "outro enrollment nao enxerga o trabalho");

  await revokeAgentEnrollment(other.enrollmentId);
  const revoked = await postResult(baseUrl, other.token, job.id, { exitCode: 0 });
  assert.equal(revoked.response.status, 401, "enrollment revogado nao reporta resultado");

  const accepted = await postResult(baseUrl, agent.token, job.id, {
    exitCode: 0,
    stdout: "saida padrao",
    stderr: "aviso",
    errorMessage: ""
  });
  assert.equal(accepted.response.status, 200);
  assert.deepEqual(accepted.body, { id: job.id, status: "succeeded", exitCode: 0, timedOut: false });

  const jobRow = await query("SELECT status, stdout, stderr, error_message, timed_out, completed_at FROM agent_script_jobs WHERE id = $1", [job.id]);
  assert.deepEqual(
    { status: jobRow.rows[0].status, stdout: jobRow.rows[0].stdout, stderr: jobRow.rows[0].stderr, error: jobRow.rows[0].error_message, timedOut: jobRow.rows[0].timed_out },
    { status: "succeeded", stdout: "saida padrao", stderr: "aviso", error: "", timedOut: false }
  );
  assert.ok(jobRow.rows[0].completed_at);
  const logRow = await query(
    "SELECT mode, status, raw_log, parsed_summary, error_detected, attention_required FROM script_execution_logs WHERE id = $1",
    [log.id]
  );
  assert.equal(logRow.rows[0].raw_log, "STDOUT:\nsaida padrao\n\nSTDERR:\naviso");
  assert.match(logRow.rows[0].parsed_summary, /executado com sucesso pelo agente/);
  assert.equal(logRow.rows[0].error_detected, false);
  assert.equal(logRow.rows[0].attention_required, false);

  const repeated = await postResult(baseUrl, agent.token, job.id, { exitCode: 1, stderr: "tentativa de sobrescrever" });
  assert.equal(repeated.response.status, 200);
  assert.deepEqual(repeated.body, { id: job.id, status: "succeeded", reused: true });
  const unchanged = await query("SELECT status, exit_code FROM agent_script_jobs WHERE id = $1", [job.id]);
  assert.deepEqual({ status: unchanged.rows[0].status, exitCode: unchanged.rows[0].exit_code }, { status: "succeeded", exitCode: 0 });
  const history = await query(
    "SELECT COUNT(*)::INTEGER AS total FROM asset_history WHERE asset_id = $1 AND event_type = 'script_execution_succeeded'",
    [agent.machineId]
  );
  assert.equal(history.rows[0].total, 1, "resultado repetido nao duplica o historico");
});

test("resultado do agente: classifica sucesso, falha e tempo limite e monta o log tecnico", async (t) => {
  const baseUrl = await startServer(t);
  const agent = await enroll(baseUrl, "job-result-status");

  const scenarios = [
    { name: "falha por codigo", body: { exitCode: 3, stderr: "falhou" }, status: "failed", exitCode: 3, summary: /terminou com falha/, raw: "STDERR:\nfalhou" },
    { name: "sem codigo de saida", body: { stdout: "x" }, status: "failed", exitCode: null, summary: /terminou com falha/, raw: "STDOUT:\nx" },
    { name: "sucesso com erro textual", body: { exitCode: 0, errorMessage: "excecao no script" }, status: "failed", exitCode: 0, summary: /terminou com falha/, raw: "ERRO:\nexcecao no script" },
    { name: "tempo limite", body: { exitCode: 0, timedOut: true, stdout: "parcial", errorMessage: "tempo esgotado" }, status: "timed_out", exitCode: 0, summary: /interrompido por tempo limite/, raw: "STDOUT:\nparcial\n\nERRO:\ntempo esgotado" },
    { name: "tudo vazio", body: { exitCode: 0 }, status: "succeeded", exitCode: 0, summary: /executado com sucesso/, raw: "" }
  ];

  for (const scenario of scenarios) {
    const { job, log } = await queueJob({ machineId: agent.machineId });
    await deliver(agent);
    const { response, body } = await postResult(baseUrl, agent.token, job.id, scenario.body);
    assert.equal(response.status, 200, scenario.name);
    assert.equal(body.status, scenario.status, scenario.name);
    assert.equal(body.exitCode, scenario.exitCode, scenario.name);
    assert.equal(body.timedOut, scenario.status === "timed_out");

    const logRow = await query(
      "SELECT status, raw_log, parsed_summary, error_detected, attention_required FROM script_execution_logs WHERE id = $1",
      [log.id]
    );
    assert.equal(logRow.rows[0].status, scenario.status, scenario.name);
    assert.equal(logRow.rows[0].raw_log, scenario.raw, scenario.name);
    assert.match(logRow.rows[0].parsed_summary, scenario.summary);
    assert.equal(logRow.rows[0].error_detected, scenario.status !== "succeeded");
    assert.equal(logRow.rows[0].attention_required, scenario.status !== "succeeded");
    const history = await query(
      "SELECT event_type, new_value FROM asset_history WHERE asset_id = $1 AND new_value LIKE $2",
      [agent.machineId, `%${job.id}%`]
    );
    assert.equal(history.rows[0].event_type, scenario.status === "succeeded" ? "script_execution_succeeded" : "script_execution_failed");
    assert.equal(JSON.parse(history.rows[0].new_value).requestedBy, "Sistema");
  }

  const truncated = await queueJob({ machineId: agent.machineId });
  await deliver(agent);
  const direct = await completeAgentScriptJob({
    jobId: truncated.job.id,
    enrollmentId: agent.enrollmentId,
    result: { exitCode: 0, stdout: "a".repeat(70000), stderr: "b".repeat(70000), errorMessage: "", timedOut: false }
  });
  assert.equal(direct.status, "succeeded");
  const stored = await query("SELECT stdout, stderr FROM agent_script_jobs WHERE id = $1", [truncated.job.id]);
  assert.equal(stored.rows[0].stdout.length, 65536);
  assert.equal(stored.rows[0].stderr.length, 65536);
});

test("resultado do agente valida o corpo recebido", async (t) => {
  const baseUrl = await startServer(t);
  const agent = await enroll(baseUrl, "job-result-validation");
  const { job } = await queueJob({ machineId: agent.machineId });
  await deliver(agent);

  const invalidBodies = [
    ["lista", []],
    ["texto", "resultado"],
    ["codigo nao numerico", { exitCode: "abc" }],
    ["codigo decimal", { exitCode: 1.5 }],
    ["codigo fora do intervalo", { exitCode: 3_000_000_000 }],
    ["stdout acima do limite", { exitCode: 0, stdout: "x".repeat(65537) }],
    ["erro acima do limite", { exitCode: 0, errorMessage: "x".repeat(4001) }]
  ];
  for (const [name, body] of invalidBodies) {
    const response = await fetch(`${baseUrl}/api/agents/jobs/${job.id}/result`, {
      method: "POST",
      headers: agentHeaders(agent.token),
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 400, name);
  }
  const longId = await postResult(baseUrl, agent.token, "j".repeat(181), { exitCode: 0 });
  assert.equal(longId.response.status, 400);

  const stillClaimed = await query("SELECT status FROM agent_script_jobs WHERE id = $1", [job.id]);
  assert.equal(stillClaimed.rows[0].status, "claimed", "corpo invalido nunca conclui o trabalho");

  const nullExit = await postResult(baseUrl, agent.token, job.id, { exitCode: null, stdout: "sem codigo" });
  assert.equal(nullExit.body.status, "failed");
});

test("conclusao fecha a execucao de automacao preventiva somente quando todos os trabalhos terminam", async (t) => {
  const baseUrl = await startServer(t);
  const agent = await enroll(baseUrl, "job-automation-run");

  async function createRun() {
    const planId = randomUUID();
    const runId = randomUUID();
    await query("INSERT INTO preventive_automation_plans (id, name) VALUES ($1, $2)", [planId, "Plano de automacao do teste"]);
    await query(
      "INSERT INTO preventive_automation_runs (id, plan_id, asset_id, status, scheduled_for) VALUES ($1, $2, $3, 'running', $4)",
      [runId, planId, agent.machineId, new Date().toISOString()]
    );
    return runId;
  }
  async function queueForRun(runId) {
    return queueJob({ machineId: agent.machineId, queueOverrides: { automationRunId: runId } });
  }
  async function runState(runId) {
    return (await query(
      "SELECT status, result, log_summary, error_detected, finished_at FROM preventive_automation_runs WHERE id = $1",
      [runId]
    )).rows[0];
  }
  const finish = (jobId, exitCode) => postResult(baseUrl, agent.token, jobId, { exitCode });

  const successRun = await createRun();
  const jobsA = [await queueForRun(successRun), await queueForRun(successRun)];
  await deliver(agent);
  await deliver(agent);
  await finish(jobsA[0].job.id, 0);
  assert.equal((await runState(successRun)).status, "running", "ainda ha trabalho pendente");
  await finish(jobsA[1].job.id, 0);
  const closedSuccess = await runState(successRun);
  assert.equal(closedSuccess.status, "success");
  assert.equal(closedSuccess.error_detected, false);
  assert.match(closedSuccess.result, /Todas as verificações foram executadas com sucesso/);
  assert.equal(closedSuccess.result, closedSuccess.log_summary);
  assert.ok(closedSuccess.finished_at);

  const mixedRun = await createRun();
  const jobsB = [await queueForRun(mixedRun), await queueForRun(mixedRun)];
  await deliver(agent);
  await deliver(agent);
  await finish(jobsB[0].job.id, 1);
  await finish(jobsB[1].job.id, 0);
  const closedMixed = await runState(mixedRun);
  assert.equal(closedMixed.status, "error", "uma falha anterior marca a execucao como erro");
  assert.equal(closedMixed.error_detected, true);
  assert.match(closedMixed.result, /Uma ou mais verificações terminaram com falha/);

  const lastFailsRun = await createRun();
  const jobsC = [await queueForRun(lastFailsRun), await queueForRun(lastFailsRun)];
  await deliver(agent);
  await deliver(agent);
  await finish(jobsC[0].job.id, 0);
  await postResult(baseUrl, agent.token, jobsC[1].job.id, { exitCode: 0, timedOut: true });
  assert.equal((await runState(lastFailsRun)).status, "error", "o ultimo trabalho com tempo limite tambem marca erro");
});

test("conclusao fecha o plano preventivo por ativo e depois o plano inteiro", async (t) => {
  const baseUrl = await startServer(t);
  const agentA = await enroll(baseUrl, "job-plan-a");
  const agentB = await enroll(baseUrl, "job-plan-b");

  async function createPlan(machineIds) {
    const planId = randomUUID();
    await query("INSERT INTO preventive_plans (id, name, status) VALUES ($1, $2, 'running')", [planId, "Plano preventivo do teste"]);
    for (const machineId of machineIds) {
      await query(
        "INSERT INTO preventive_plan_assets (id, preventive_plan_id, asset_id, status) VALUES ($1, $2, $3, 'running')",
        [randomUUID(), planId, machineId]
      );
    }
    return planId;
  }
  const queueForPlan = (agent, planId) => queueJob({
    machineId: agent.machineId,
    logOverrides: { preventivePlanId: planId }
  });
  const planAsset = async (planId, machineId) => (await query(
    "SELECT status, log, completed_at FROM preventive_plan_assets WHERE preventive_plan_id = $1 AND asset_id = $2",
    [planId, machineId]
  )).rows[0];
  const planStatus = async (planId) => (await query("SELECT status FROM preventive_plans WHERE id = $1", [planId])).rows[0].status;
  const finish = (agent, jobId, exitCode) => postResult(baseUrl, agent.token, jobId, { exitCode });

  const planOk = await createPlan([agentA.machineId, agentB.machineId]);
  const okA = [await queueForPlan(agentA, planOk), await queueForPlan(agentA, planOk)];
  const okB = await queueForPlan(agentB, planOk);
  await deliver(agentA);
  await deliver(agentA);
  await deliver(agentB);

  await finish(agentA, okA[0].job.id, 0);
  assert.equal((await planAsset(planOk, agentA.machineId)).status, "running", "ainda ha trabalho pendente na maquina");
  await finish(agentA, okA[1].job.id, 0);
  const assetA = await planAsset(planOk, agentA.machineId);
  assert.equal(assetA.status, "completed");
  assert.match(assetA.log, /Todas as verificações foram executadas com sucesso/);
  assert.ok(assetA.completed_at);
  assert.equal(await planStatus(planOk), "running", "o plano so fecha quando todas as maquinas terminam");
  await finish(agentB, okB.job.id, 0);
  assert.equal(await planStatus(planOk), "completed");

  const planFailed = await createPlan([agentA.machineId, agentB.machineId]);
  const failA = await queueForPlan(agentA, planFailed);
  const failB = await queueForPlan(agentB, planFailed);
  await deliver(agentA);
  await deliver(agentB);
  await finish(agentA, failA.job.id, 2);
  const failedAsset = await planAsset(planFailed, agentA.machineId);
  assert.equal(failedAsset.status, "failed");
  assert.match(failedAsset.log, /Uma ou mais verificações terminaram com falha/);
  await finish(agentB, failB.job.id, 0);
  assert.equal(await planStatus(planFailed), "failed", "uma maquina com falha marca o plano como falho");

  const planPriorFailure = await createPlan([agentA.machineId]);
  const prior = [await queueForPlan(agentA, planPriorFailure), await queueForPlan(agentA, planPriorFailure)];
  await deliver(agentA);
  await deliver(agentA);
  await finish(agentA, prior[0].job.id, 1);
  await finish(agentA, prior[1].job.id, 0);
  assert.equal((await planAsset(planPriorFailure, agentA.machineId)).status, "failed");
  assert.equal(await planStatus(planPriorFailure), "failed");
});
