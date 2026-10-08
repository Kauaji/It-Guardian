import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

const database = await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "preventive-runs-integration-secret-with-32-chars";
process.env.NODE_ENV = "test";

const fx = await import("../test-support/preventiveFixtures.mjs");
const { closeDatabase } = await import("../src/database.js");
const repository = await import("../src/services/preventiveAutomationFacade.js");

const base = fx.automationPath;
const adminUser = { id: null, name: "Teste de execucao", isAdmin: true };
let api;
let baseUrl;
let closeServer;
let scripts;
let manualDevice;

const hoursFromNow = (hours) => new Date(Date.now() + hours * 3600 * 1000).toISOString();

test.before(async () => {
  const holder = {
    after: (callback) => {
      closeServer = callback;
    }
  };
  baseUrl = await fx.startServer(holder);
  api = fx.createClient(baseUrl, await fx.login(baseUrl));
  scripts = {
    first: await fx.createScript("Script de execucao um"),
    second: await fx.createScript("Script de execucao dois")
  };
  for (const machineId of ["rn-a1", "rn-a2"]) await fx.enrollAgentAsset(baseUrl, machineId);
  await fx.assignSegment("rn-a1", "demo-segment-servers");
  await fx.assignSegment("rn-a2", "demo-segment-workstations");
  manualDevice = await fx.createManualDevice("Maquina sem agente", "RUN-MAN-1", "203.0.113.90");
});

test.after(async () => {
  if (closeServer) await closeServer();
  await closeDatabase();
});

async function createPlan(payload) {
  const response = await api.post(base, { defaultScriptIds: [scripts.first.id], ...payload });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.preventiveAutomationPlan;
}

async function removePlan(plan) {
  await api.del(`${base}/${plan.id}`);
}

async function jobsOfPlan(planId) {
  return fx.rows(
    `
      SELECT jobs.asset_id, jobs.script_id, jobs.status
      FROM agent_script_jobs jobs
      INNER JOIN preventive_automation_runs runs ON runs.id = jobs.automation_run_id
      WHERE runs.plan_id = $1
      ORDER BY jobs.asset_id, jobs.script_id
    `,
    [planId]
  );
}

test("preparacao manual cria uma execucao por maquina e enfileira os scripts no agente", async () => {
  const plan = await createPlan({
    name: "Preparacao manual completa",
    scopeType: "asset_list",
    assetIds: ["rn-a1", "rn-a2"],
    defaultScriptIds: [scripts.first.id, scripts.second.id],
    indicatorColor: "#0a1b2c"
  });
  const nextRunBefore = plan.nextRunAt;

  const response = await api.post(`${base}/${plan.id}/prepare`);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.preparedCount, 2);
  assert.equal(response.body.skippedExistingCount, 0);
  assert.equal(response.body.runs.length, 2);
  for (const run of response.body.runs) {
    assert.equal(run.status, "waiting_agent");
    assert.equal(run.triggerType, "manual");
    assert.equal(run.result, "queued");
    assert.equal(run.errorDetected, false);
    assert.match(run.logSummary, /2 script\(s\) previsto\(s\)/);
    assert.match(run.idempotencyKey, new RegExp(`^${plan.id}:rn-a[12]:`));
    assert.ok(run.nextRunAt);
  }
  assert.deepEqual(response.body.runs.map((run) => run.assetId).sort(), ["rn-a1", "rn-a2"]);

  const prepared = response.body.preventiveAutomationPlan;
  assert.ok(prepared.lastPreparedAt);
  assert.equal(prepared.nextRunAt, nextRunBefore, "preparo manual nao move a proxima agenda");
  assert.ok(prepared.latestRun);
  assert.ok(prepared.recentRuns.length >= 1);

  const jobs = await jobsOfPlan(plan.id);
  assert.equal(jobs.length, 4, "uma tarefa por script em cada maquina");
  assert.deepEqual([...new Set(jobs.map((job) => job.status))], ["queued"]);

  const history = await fx.rows(
    "SELECT asset_id FROM asset_history WHERE event_type = 'preventive_automation_queued' AND message LIKE $1 ORDER BY asset_id",
    ["%Preparacao manual completa%"]
  );
  assert.deepEqual(
    history.map((row) => row.asset_id),
    ["rn-a1", "rn-a2"]
  );

  const audit = await fx.rows(
    "SELECT meta FROM audit_logs WHERE type = 'preventive_automation_manual_prepared' AND meta->>'preventiveAutomationPlanId' = $1",
    [plan.id]
  );
  assert.equal(audit.length, 1);
  assert.equal(audit[0].meta.runCount, 2);

  const detail = (await api.get(`${base}/${plan.id}`)).body.preventiveAutomationPlan;
  assert.ok(detail.latestRun, "detalhe expoe a ultima execucao");
  assert.equal(detail.recentRuns.length, 2);

  await removePlan(plan);
});

test("preparo no mesmo horario e idempotente e nao duplica execucoes", async () => {
  const plan = await createPlan({
    name: "Preparacao idempotente",
    scopeType: "asset_list",
    assetIds: ["rn-a1", "rn-a2"],
    indicatorColor: "#0a1b2d"
  });
  const slot = new Date("2026-03-04T12:34:56.789Z");

  const first = await repository.preparePreventiveAutomationPlan(plan.id, adminUser, {
    triggerType: "manual",
    scheduledFor: slot
  });
  assert.equal(first.preparedCount, 2);
  assert.equal(first.runs[0].scheduledFor, "2026-03-04T12:34:00.000Z", "horario normalizado ao minuto");

  const second = await repository.preparePreventiveAutomationPlan(plan.id, adminUser, {
    triggerType: "manual",
    scheduledFor: slot
  });
  assert.equal(second.preparedCount, 0);
  assert.equal(second.skippedExistingCount, 2);
  assert.deepEqual(second.runs.map((run) => run.id).sort(), first.runs.map((run) => run.id).sort());

  const stored = await fx.rows("SELECT id FROM preventive_automation_runs WHERE plan_id = $1", [plan.id]);
  assert.equal(stored.length, 2);
  assert.equal((await jobsOfPlan(plan.id)).length, 2);

  assert.equal(
    repository.buildRunIdempotencyKey(plan.id, "rn-a1", "2026-03-04T12:34:56.789Z"),
    `${plan.id}:rn-a1:2026-03-04T12:34:56.789Z`
  );

  await removePlan(plan);
});

test("preparo recusa plano inativo, inexistente, com script inativo ou maquina sem agente", async () => {
  assert.equal((await api.post(`${base}/plano-inexistente/prepare`)).status, 404);

  const inactive = await createPlan({
    name: "Preparacao de plano inativo",
    scopeType: "asset",
    scopeId: "rn-a1",
    indicatorColor: "#0a1b2e"
  });
  await api.post(`${base}/${inactive.id}/disable`);
  const inactiveResponse = await api.post(`${base}/${inactive.id}/prepare`);
  assert.equal(inactiveResponse.status, 409);
  assert.match(inactiveResponse.body.message, /plano inativo não pode ser preparado/);
  await removePlan(inactive);

  const withoutAgent = await createPlan({
    name: "Preparacao sem agente ativo",
    scopeType: "asset",
    scopeId: manualDevice.id,
    indicatorColor: "#0a1b2f"
  });
  const noAgent = await api.post(`${base}/${withoutAgent.id}/prepare`);
  assert.equal(noAgent.status, 409, JSON.stringify(noAgent.body));
  assert.match(noAgent.body.message, /não possui um agente ativo|nao possui um agente ativo/);
  if (database.mode === "postgres") {
    const stored = await fx.rows("SELECT id FROM preventive_automation_runs WHERE plan_id = $1", [withoutAgent.id]);
    assert.equal(stored.length, 0, "a transacao inteira deve ser desfeita");
  }
  await removePlan(withoutAgent);

  const doomedScript = await fx.createScript("Script que sera desativado");
  const doomed = await createPlan({
    name: "Preparacao com script desativado",
    scopeType: "asset",
    scopeId: "rn-a1",
    defaultScriptIds: [doomedScript.id],
    indicatorColor: "#0a1b30"
  });
  await fx.rows("UPDATE maintenance_scripts SET active = FALSE WHERE id = $1", [doomedScript.id]);
  const doomedResponse = await api.post(`${base}/${doomed.id}/prepare`);
  assert.equal(doomedResponse.status, 400);
  assert.match(doomedResponse.body.message, /não existe ou está inativo/);
  await removePlan(doomed);
});

test("processamento de vencidos prepara so as agendas vencidas e reagenda", async () => {
  const dueAt = new Date(Date.now() - 2 * 3600 * 1000);
  // O horario preferido do plano acompanha o vencimento (em UTC). Um vencimento fora do horario preferido
  // (padrao 08:00 America/Sao_Paulo) faz a "proxima ocorrencia" cair em hoje, as vezes ja no passado: o teste
  // falhava so entre 08:00 e 10:00 de Brasilia.
  const plan = await createPlan({
    name: "Plano com agenda vencida",
    scopeType: "asset_list",
    assetIds: ["rn-a1", "rn-a2"],
    recurrenceType: "weekly",
    preferredTime: dueAt.toISOString().slice(11, 16),
    timezone: "UTC",
    indicatorColor: "#0a1b31"
  });
  await fx.setScheduleNextRun(plan.id, "rn-a1", dueAt.toISOString());

  const due = await repository.listDuePreventiveAutomationPlans(new Date());
  assert.deepEqual(
    due.map((item) => item.id),
    [plan.id]
  );
  assert.equal((await repository.listDuePreventiveAutomationPlans(new Date("2000-01-01T00:00:00Z"))).length, 0);

  const response = await api.post(`${base}/process-due`);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.duePlanCount, 1);
  assert.equal(response.body.preparedPlanCount, 1);
  assert.equal(response.body.preparedRunCount, 1);
  assert.equal(response.body.skippedPlanCount, 0);
  assert.equal(response.body.failedPlanCount, 0);
  assert.equal(response.body.plans[0].planId, plan.id);
  assert.equal(response.body.plans[0].status, "prepared");
  assert.equal(response.body.plans[0].message, "Plano preparado.");

  const runs = await fx.rows(
    "SELECT asset_id, trigger_type, status, scheduled_for, next_run_at FROM preventive_automation_runs WHERE plan_id = $1",
    [plan.id]
  );
  assert.equal(runs.length, 1);
  assert.equal(runs[0].asset_id, "rn-a1");
  assert.equal(runs[0].trigger_type, "scheduled");
  assert.equal(runs[0].status, "waiting_agent");
  const slot = new Date(dueAt);
  slot.setSeconds(0, 0);
  assert.equal(new Date(runs[0].scheduled_for).toISOString(), slot.toISOString());

  const detail = (await api.get(`${base}/${plan.id}`)).body.preventiveAutomationPlan;
  const schedules = Object.fromEntries(detail.assetSchedules.map((schedule) => [schedule.assetId, schedule]));
  assert.ok(new Date(schedules["rn-a1"].nextRunAt) > new Date(), "agenda preparada avanca para o futuro");
  assert.ok(schedules["rn-a1"].lastPreparedAt);
  assert.equal(schedules["rn-a1"].lastScheduledAt, slot.toISOString());
  assert.equal(schedules["rn-a2"].lastPreparedAt, null, "maquina nao vencida nao e tocada");
  assert.ok(detail.lastPreparedAt);

  const again = await api.post(`${base}/process-due`);
  assert.equal(again.body.duePlanCount, 0);
  assert.equal(again.body.preparedRunCount, 0);
  assert.deepEqual(again.body.plans, []);

  await removePlan(plan);
});

test("processamento de vencidos registra falha por plano sem interromper os demais", async () => {
  const broken = await createPlan({
    name: "Plano vencido sem agente",
    scopeType: "asset",
    scopeId: manualDevice.id,
    indicatorColor: "#0a1b32"
  });
  const healthy = await createPlan({
    name: "Plano vencido saudavel",
    scopeType: "asset",
    scopeId: "rn-a2",
    indicatorColor: "#0a1b33"
  });
  await fx.setScheduleNextRun(broken.id, manualDevice.id, hoursFromNow(-3));
  await fx.setScheduleNextRun(healthy.id, "rn-a2", hoursFromNow(-3));

  const response = await api.post(`${base}/process-due`);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.duePlanCount, 2);
  assert.equal(response.body.failedPlanCount, 1);
  assert.equal(response.body.preparedPlanCount, 1);
  const byPlan = Object.fromEntries(response.body.plans.map((item) => [item.planId, item]));
  assert.equal(byPlan[broken.id].status, "failed");
  assert.equal(byPlan[broken.id].preparedCount, 0);
  assert.match(byPlan[broken.id].message, /agente ativo/);
  assert.equal(byPlan[healthy.id].status, "prepared");

  const audit = await fx.rows(
    "SELECT message FROM audit_logs WHERE type = 'preventive_automation_scheduler_plan_failed' AND meta->>'preventiveAutomationPlanId' = $1",
    [broken.id]
  );
  assert.equal(audit.length, 1);

  await removePlan(broken);
  await removePlan(healthy);
});

test("rota de cron exige segredo configurado e valido e executa as rotinas agendadas", async () => {
  const cronUrl = `${baseUrl}${base}/process-due/cron`;
  const previous = { cron: process.env.CRON_SECRET, preventive: process.env.PREVENTIVE_CRON_SECRET };
  delete process.env.CRON_SECRET;
  delete process.env.PREVENTIVE_CRON_SECRET;

  try {
    const unconfigured = await fetch(cronUrl);
    assert.equal(unconfigured.status, 503);

    process.env.CRON_SECRET = "segredo-do-cron-de-teste";
    const missing = await fetch(cronUrl);
    assert.equal(missing.status, 401);
    const wrong = await fetch(cronUrl, { headers: { authorization: "Bearer segredo-errado" } });
    assert.equal(wrong.status, 403);
    const wrongHeader = await fetch(cronUrl, { headers: { "x-preventive-cron-secret": "outro" } });
    assert.equal(wrongHeader.status, 403);
    const shorter = await fetch(cronUrl, { headers: { "x-preventive-cron-secret": "x" } });
    assert.equal(shorter.status, 403);

    const plan = await createPlan({
      name: "Plano do cron",
      scopeType: "asset",
      scopeId: "rn-a1",
      indicatorColor: "#0a1b34"
    });
    await fx.setScheduleNextRun(plan.id, "rn-a1", hoursFromNow(-1));

    const ok = await fetch(cronUrl, { headers: { authorization: "Bearer segredo-do-cron-de-teste" } });
    const body = await ok.json();
    assert.equal(ok.status, 200, JSON.stringify(body));
    assert.equal(body.success, true);
    assert.equal(body.preventivePlans.duePlanCount, 1);
    assert.equal(body.preventivePlans.preparedPlanCount, 1, "o scheduler tem visao global e prepara o plano vencido");
    assert.equal(body.preventivePlans.failedPlanCount, 0);
    const scheduled = await fx.rows("SELECT trigger_type, status FROM preventive_automation_runs WHERE plan_id = $1", [plan.id]);
    assert.deepEqual(
      scheduled.map((row) => row.trigger_type),
      ["scheduled"]
    );
    const queuedBy = await fx.rows(
      "SELECT user_name FROM asset_history WHERE event_type = 'preventive_automation_queued' AND message LIKE $1",
      ["%Plano do cron%"]
    );
    assert.equal(queuedBy[0].user_name, "Scheduler preventivo");
    assert.ok(body.scriptValidations);
    assert.ok(body.serviceOrderAutoPriority !== undefined);
    assert.ok(body.serviceOrderSlaBreaches !== undefined);
    assert.ok(Array.isArray(body.errors));
    assert.equal(typeof body.durationMs, "number");
    assert.ok(body.startedAt <= body.finishedAt);

    process.env.PREVENTIVE_CRON_SECRET = "segredo-alternativo";
    delete process.env.CRON_SECRET;
    const viaHeader = await fetch(cronUrl, {
      method: "POST",
      headers: { "x-preventive-cron-secret": "segredo-alternativo" }
    });
    assert.equal(viaHeader.status, 200);
    assert.ok((await viaHeader.json()).preventivePlans);

    await removePlan(plan);
  } finally {
    if (previous.cron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous.cron;
    if (previous.preventive === undefined) delete process.env.PREVENTIVE_CRON_SECRET;
    else process.env.PREVENTIVE_CRON_SECRET = previous.preventive;
  }
});

test("backfill recria agendas ausentes, ignora as corretas e relata planos com falha", async () => {
  const plan = await createPlan({
    name: "Plano do backfill",
    scopeType: "segment",
    scopeId: "demo-segment-workstations",
    indicatorColor: "#0a1b35"
  });
  await fx.rows("DELETE FROM preventive_automation_asset_schedules WHERE plan_id = $1", [plan.id]);

  const brokenId = randomUUID();
  await fx.rows(
    `
      INSERT INTO preventive_automation_plans (
        id, name, scope_type, scope_id, default_script_ids, indicator_color, active
      )
      VALUES ($1, 'Plano com escopo quebrado', 'segment', 'segmento-que-nao-existe', '[]', '#0a1b36', TRUE)
    `,
    [brokenId]
  );

  const summary = await repository.backfillPreventiveAutomationAssetSchedules({ user: adminUser });
  assert.ok(summary.analyzedPlanCount >= 2);
  assert.equal(summary.createdScheduleCount, 1);
  assert.equal(summary.failedPlanCount, 1);
  const byPlan = Object.fromEntries(summary.plans.map((item) => [item.planId, item]));
  assert.equal(byPlan[plan.id].status, "ok");
  assert.equal(byPlan[plan.id].created, 1);
  assert.equal(byPlan[plan.id].assetCount, 1);
  assert.equal(byPlan[brokenId].status, "failed");
  assert.match(byPlan[brokenId].message, /escopo selecionado não existe/);

  const recreated = await fx.rows("SELECT asset_id, active, next_run_at FROM preventive_automation_asset_schedules WHERE plan_id = $1", [
    plan.id
  ]);
  assert.deepEqual(
    recreated.map((row) => row.asset_id),
    ["rn-a2"]
  );
  assert.equal(recreated[0].active, true);
  assert.ok(recreated[0].next_run_at);

  const rerun = await repository.backfillPreventiveAutomationAssetSchedules({ user: adminUser });
  const rerunPlan = rerun.plans.find((item) => item.planId === plan.id);
  assert.equal(rerunPlan.created, 0);
  assert.equal(rerunPlan.updated, 0);
  assert.equal(rerunPlan.ignored, 1);

  const audit = await fx.rows("SELECT message, meta FROM audit_logs WHERE type = 'preventive_automation_schedule_backfill'");
  assert.ok(audit.length >= 2);
  assert.ok(audit.some((row) => row.meta.failedPlanCount === 1 && row.meta.createdScheduleCount === 1));

  await fx.rows("DELETE FROM preventive_automation_plans WHERE id = $1", [brokenId]);
  await removePlan(plan);
});

test("planos legados sem agenda calculada recebem ancora e proxima execucao ao serem lidos", async () => {
  const legacyId = randomUUID();
  await fx.rows(
    `
      INSERT INTO preventive_automation_plans (
        id, name, scope_type, scope_id, default_script_ids, indicator_color, recurrence_type, preferred_time
      )
      VALUES ($1, 'Plano legado sem agenda', 'asset', 'rn-a1', $2, '#0a1b37', 'daily', '07:30')
    `,
    [legacyId, JSON.stringify([scripts.first.id])]
  );

  const detail = await api.get(`${base}/${legacyId}`);
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  const plan = detail.body.preventiveAutomationPlan;
  assert.ok(plan.scheduleAnchorAt);
  assert.ok(plan.nextRunAt);
  assert.equal(plan.lastScheduledAt, plan.nextRunAt);
  assert.equal(plan.recurrenceType, "daily");

  const stored = await fx.rows("SELECT schedule_anchor_at, next_run_at, last_scheduled_at FROM preventive_automation_plans WHERE id = $1", [
    legacyId
  ]);
  assert.ok(stored[0].schedule_anchor_at && stored[0].next_run_at && stored[0].last_scheduled_at);

  const listed = await api.get(base);
  assert.ok(listed.body.preventiveAutomationPlans.some((item) => item.id === legacyId));
  await fx.rows("DELETE FROM preventive_automation_plans WHERE id = $1", [legacyId]);
});

test(
  "transacao de criacao e atomica quando um override duplicado falha (PostgreSQL real)",
  {
    skip: database.mode !== "postgres" && "pg-mem ignora ROLLBACK"
  },
  async () => {
    const response = await api.post(base, {
      name: "Plano atomico",
      scopeType: "asset",
      scopeId: "rn-a1",
      defaultScriptIds: [scripts.first.id],
      indicatorColor: "#0a1b38",
      overrides: [
        { assetId: "rn-a1", recurrenceType: "weekly" },
        { assetId: "rn-a1", recurrenceType: "daily" }
      ]
    });
    assert.equal(response.status, 409);
    const stored = await fx.rows("SELECT id FROM preventive_automation_plans WHERE name = 'Plano atomico'");
    assert.equal(stored.length, 0);
  }
);
