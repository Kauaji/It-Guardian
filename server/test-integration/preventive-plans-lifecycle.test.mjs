import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

const database = await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "preventive-plans-lifecycle-secret-with-32-chars";
process.env.NODE_ENV = "test";

const fx = await import("../test-support/preventiveFixtures.mjs");
const { closeDatabase } = await import("../src/database.js");

const base = fx.preventivePlansPath;
let api;
let baseUrl;
let closeServer;
let scripts;

test.before(async () => {
  const holder = {
    after: (callback) => {
      closeServer = callback;
    }
  };
  baseUrl = await fx.startServer(holder);
  api = fx.createClient(baseUrl, await fx.login(baseUrl));
  scripts = {
    first: await fx.createScript("Verificacao preventiva um"),
    second: await fx.createScript("Verificacao preventiva dois", { category: "Disco" }),
    risky: await fx.createScript("Verificacao de alto risco", {
      riskLevel: "high",
      content: "Write-Host 'verificacao pesada de preventiva'"
    }),
    inactive: await fx.createScript("Verificacao preventiva inativa", { active: false })
  };
  for (const machineId of ["pp-a1", "pp-a2", "pp-a3", "pp-a4"]) await fx.enrollAgentAsset(baseUrl, machineId);
});

test.after(async () => {
  if (closeServer) await closeServer();
  await closeDatabase();
});

async function jobsForAsset(assetId) {
  return fx.rows("SELECT script_id, status FROM agent_script_jobs WHERE asset_id = $1 ORDER BY script_id", [assetId]);
}

test("plano preventivo manual registra maquinas, scripts e enfileira a execucao no agente", async () => {
  const response = await api.post(base, {
    name: "  Preventiva manual das estacoes  ",
    description: "Revisao trimestral",
    notes: "Observacao do tecnico",
    assetIds: ["pp-a1", "pp-a2", "pp-a1", " "],
    scriptIds: [scripts.first.id, scripts.second.id, scripts.first.id],
    source: "alerta"
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const plan = response.body.preventivePlan;

  assert.equal(plan.name, "Preventiva manual das estacoes");
  assert.equal(plan.description, "Revisao trimestral");
  assert.equal(plan.status, "prepared");
  assert.equal(plan.source, "alerta");
  assert.equal(plan.originAlertId, null);
  assert.equal(plan.originSuggestionId, null);
  assert.equal(plan.notes, "Observacao do tecnico");
  assert.equal(plan.serviceOrderId, null);
  assert.equal(plan.serviceOrder, null);
  assert.deepEqual(plan.automation, { enabled: false });
  assert.ok(plan.preparedAt);

  assert.deepEqual(
    plan.scripts.map((script) => script.orderIndex),
    [0, 1]
  );
  assert.deepEqual(
    plan.scripts.map((script) => script.scriptName),
    ["Verificacao preventiva um", "Verificacao preventiva dois"]
  );
  assert.equal(plan.scripts[1].category, "Disco");
  assert.equal(plan.scripts[0].riskLevel, "low");
  assert.equal(plan.scripts[0].scriptType, "powershell");

  assert.deepEqual(plan.assets.map((asset) => asset.assetId).sort(), ["pp-a1", "pp-a2"]);
  for (const asset of plan.assets) {
    assert.equal(asset.status, "waiting_agent");
    assert.match(asset.log, /Scripts enfileirados para execução pelo agente autenticado/);
    assert.match(asset.log, /Verificacao preventiva um, Verificacao preventiva dois/);
  }

  for (const assetId of ["pp-a1", "pp-a2"]) {
    const jobs = await jobsForAsset(assetId);
    assert.equal(jobs.length, 2, `uma tarefa por script em ${assetId}`);
    assert.ok(jobs.every((job) => job.status === "queued"));
  }

  const history = await fx.rows(
    "SELECT asset_id, new_value FROM asset_history WHERE event_type = 'preventive_execution_queued' ORDER BY asset_id"
  );
  assert.deepEqual(
    history.map((row) => row.asset_id),
    ["pp-a1", "pp-a2"]
  );
  const payload = JSON.parse(history[0].new_value);
  assert.equal(payload.preventivePlanId, plan.id);
  assert.equal(payload.status, "queued");
  assert.equal(payload.jobIds.length, 2);

  const audit = await fx.rows(
    "SELECT message, meta FROM audit_logs WHERE type = 'preventive_plan_created' AND meta->>'preventivePlanId' = $1",
    [plan.id]
  );
  assert.equal(audit.length, 1);
  assert.equal(audit[0].meta.assetCount, 2);
  assert.equal(audit[0].meta.scriptCount, 2);
});

test("plano preventivo com automacao vinculada cria a agenda e nao enfileira jobs agora", async () => {
  const response = await api.post(base, {
    name: "Preventiva automatizada de servidores",
    notes: "Notas herdadas",
    assetIds: ["pp-a3", "pp-a4"],
    scriptIds: [scripts.first.id],
    automation: {
      enabled: true,
      recurrenceType: "weekly",
      preferredTime: "09:00",
      indicatorColor: "#c0ffee"
    }
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const plan = response.body.preventivePlan;

  assert.equal(plan.automation.enabled, true);
  assert.equal(plan.automation.preventivePlanId, plan.id);
  assert.equal(plan.automation.name, "Preventiva automatizada de servidores");
  assert.equal(plan.automation.notes, "Notas herdadas");
  assert.equal(plan.automation.scopeType, "asset_list");
  assert.equal(plan.automation.scopeId, null);
  assert.deepEqual(plan.automation.assetIds, ["pp-a3", "pp-a4"]);
  assert.deepEqual(plan.automation.defaultScriptIds, [scripts.first.id]);
  assert.equal(plan.automation.recurrenceType, "weekly");
  assert.equal(plan.automation.preferredTime, "09:00");
  assert.equal(plan.automation.indicatorColor, "#c0ffee");
  assert.equal(plan.automation.active, true);
  assert.equal(plan.automation.assetSchedules.length, 2);
  assert.ok(plan.automation.nextRunAt);
  assert.ok(plan.assets.every((asset) => asset.status === "prepared"));
  assert.match(plan.assets[0].log, /Execução será iniciada pela agenda de automação/);

  for (const assetId of ["pp-a3", "pp-a4"]) {
    assert.equal((await jobsForAsset(assetId)).length, 0, "a agenda e quem dispara a execucao");
  }

  const events = await fx.rows("SELECT event_type FROM asset_history WHERE asset_id = 'pp-a3' ORDER BY created_at ASC");
  const types = events.map((row) => row.event_type);
  assert.ok(types.includes("preventive_plan_prepared"));
  assert.ok(types.includes("preventive_automation_enabled"));

  const linked = await fx.rows(
    "SELECT meta FROM audit_logs WHERE type = 'preventive_plan_automation_linked' AND meta->>'preventivePlanId' = $1",
    [plan.id]
  );
  assert.equal(linked.length, 1);

  const automationList = await api.get(fx.automationPath);
  const automation = automationList.body.preventiveAutomationPlans.find((item) => item.preventivePlanId === plan.id);
  assert.ok(automation, "a automacao aparece na lista de automacoes");
  assert.equal(automation.preventivePlanName, "Preventiva automatizada de servidores");
  assert.equal(automation.id, plan.automation.id);

  const listed = await api.get(base);
  const fromList = listed.body.preventivePlans.find((item) => item.id === plan.id);
  assert.equal(fromList.automation.enabled, true);
  assert.equal(fromList.assets.length, 2);
});

test(
  "plano com automacao invalida desfaz o registro inteiro (PostgreSQL real)",
  {
    skip: database.mode !== "postgres" && "pg-mem ignora ROLLBACK"
  },
  async () => {
    const response = await api.post(base, {
      name: "Preventiva com automacao quebrada",
      assetIds: ["pp-a3"],
      scriptIds: [scripts.first.id],
      automation: { enabled: true, recurrenceType: "custom_days" }
    });
    assert.equal(response.status, 400, JSON.stringify(response.body));
    assert.match(response.body.message, /quantidade de dias/);
    const stored = await fx.rows("SELECT id FROM preventive_plans WHERE name = 'Preventiva com automacao quebrada'");
    assert.equal(stored.length, 0);
  }
);

test("valida payload, scripts e risco antes de registrar o plano", async () => {
  const cases = [
    [{ name: "ab", assetIds: ["pp-a1"], scriptIds: [scripts.first.id] }, /pelo menos 3 caracteres/],
    [{ name: "Plano sem maquinas", assetIds: [], scriptIds: [scripts.first.id] }, /pelo menos uma máquina/],
    [{ name: "Plano sem maquinas 2", scriptIds: [scripts.first.id] }, /pelo menos uma máquina/],
    [{ name: "Plano sem scripts", assetIds: ["pp-a1"], scriptIds: [] }, /pelo menos uma verificação/],
    [{ name: "Plano script inexistente", assetIds: ["pp-a1"], scriptIds: ["script-fantasma"] }, /não existe ou está inativo/],
    [{ name: "Plano script inativo", assetIds: ["pp-a1"], scriptIds: [scripts.inactive.id] }, /não existe ou está inativo/],
    [{ name: "Plano de alto risco", assetIds: ["pp-a1"], scriptIds: [scripts.risky.id] }, /alto risco exigem confirmação extra/]
  ];
  for (const [payload, pattern] of cases) {
    const response = await api.post(base, payload);
    assert.equal(response.status, 400, `${payload.name}: ${JSON.stringify(response.body)}`);
    assert.match(response.body.message, pattern, payload.name);
  }

  const acknowledged = await api.post(base, {
    name: "Plano de alto risco confirmado",
    assetIds: ["pp-a1"],
    scriptIds: [scripts.risky.id],
    riskAcknowledged: true,
    status: "estado-invalido"
  });
  assert.equal(acknowledged.status, 201, JSON.stringify(acknowledged.body));
  assert.equal(acknowledged.body.preventivePlan.status, "prepared", "status desconhecido volta ao padrao");

  const completed = await api.post(base, {
    name: "Plano com status informado",
    assetIds: ["pp-a2"],
    scriptIds: [scripts.first.id],
    status: "completed"
  });
  assert.equal(completed.body.preventivePlan.status, "completed");

  const noAgent = await api.post(base, {
    name: "Plano sem agente na maquina",
    assetIds: ["maquina-sem-agente"],
    scriptIds: [scripts.first.id]
  });
  assert.equal(noAgent.status, 409, JSON.stringify(noAgent.body));
  assert.match(noAgent.body.message, /agente ativo/);
});

test("detalhe, logs e confirmacao do registro preventivo", async () => {
  const created = await api.post(base, {
    name: "Plano para confirmar",
    assetIds: ["pp-a3"],
    scriptIds: [scripts.first.id],
    automation: { enabled: true, indicatorColor: "#abc123" }
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const plan = created.body.preventivePlan;

  const detail = await api.get(`${base}/${plan.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.preventivePlan.id, plan.id);
  assert.equal((await api.get(`${base}/plano-inexistente`)).status, 404);

  const logs = await api.get(`${base}/${plan.id}/logs`);
  assert.equal(logs.status, 200);
  assert.equal(logs.body.logs.length, 1);
  assert.equal(logs.body.logs[0].assetId, "pp-a3");
  assert.equal(logs.body.logs[0].status, "prepared");
  assert.match(logs.body.logs[0].log, /Preventiva registrada para pp-a3/);
  assert.equal((await api.get(`${base}/plano-inexistente/logs`)).status, 404);

  const prepared = await api.post(`${base}/${plan.id}/prepare`);
  assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
  assert.equal(prepared.body.preventivePlan.status, "simulated");
  assert.ok(prepared.body.preventivePlan.assets.every((asset) => asset.status === "prepared"));
  const audit = await fx.rows("SELECT message FROM audit_logs WHERE type = 'preventive_plan_prepared' AND meta->>'preventivePlanId' = $1", [
    plan.id
  ]);
  assert.equal(audit.length, 1);
  assert.match(audit[0].message, /Nenhum comando foi executado/);

  assert.equal((await api.post(`${base}/plano-inexistente/prepare`)).status, 404);
});

test("OS preventiva e criada manualmente a partir do plano e nao duplica", async () => {
  const single = (
    await api.post(base, {
      name: "Plano para gerar OS",
      assetIds: ["pp-a4"],
      scriptIds: [scripts.first.id],
      automation: { enabled: true, indicatorColor: "#facade" }
    })
  ).body.preventivePlan;

  const created = await api.post(`${base}/${single.id}/service-order`);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const { preventivePlan, serviceOrder } = created.body;
  assert.equal(preventivePlan.serviceOrderId, serviceOrder.id);
  assert.equal(preventivePlan.serviceOrder.id, serviceOrder.id);
  assert.equal(serviceOrder.title, "Manutenção preventiva — pp-a4");
  assert.equal(serviceOrder.category, "Preventiva");
  assert.equal(serviceOrder.assetId, "pp-a4");
  assert.match(serviceOrder.description, /Plano para gerar OS/);
  assert.match(serviceOrder.description, /Nenhum comando foi executado automaticamente/);

  const history = await fx.rows("SELECT event_type FROM service_order_history WHERE service_order_id = $1", [serviceOrder.id]);
  assert.ok(history.some((row) => row.event_type === "preventive_plan_origin"));
  const assetEvents = await fx.rows(
    "SELECT message FROM asset_history WHERE asset_id = 'pp-a4' AND event_type = 'preventive_plan_service_order'"
  );
  assert.equal(assetEvents.length, 1);

  const duplicate = await api.post(`${base}/${single.id}/service-order`);
  assert.equal(duplicate.status, 409);
  assert.match(duplicate.body.message, /já possui uma OS preventiva vinculada/);

  assert.equal((await api.post(`${base}/plano-inexistente/service-order`)).status, 404);

  const multi = (
    await api.post(base, {
      name: "Plano multiplas maquinas OS",
      assetIds: ["pp-a1", "pp-a2"],
      scriptIds: [scripts.first.id],
      automation: { enabled: true, indicatorColor: "#decade" }
    })
  ).body.preventivePlan;
  const multiOrder = await api.post(`${base}/${multi.id}/service-order`);
  assert.equal(multiOrder.status, 201, JSON.stringify(multiOrder.body));
  assert.equal(multiOrder.body.serviceOrder.title, "Manutenção preventiva — 2 máquina(s)");
  assert.equal(multiOrder.body.serviceOrder.assetId ?? null, null);
});

test("rotas de planos preventivos exigem as permissoes especificas", async () => {
  assert.equal((await fx.createClient(baseUrl, "").get(base)).status, 401);

  await fx.createRestrictedUser({
    email: "leitor-preventivas@itguardian.local",
    permissions: ["preventive_plans.view"]
  });
  const reader = fx.createClient(baseUrl, await fx.login(baseUrl, "leitor-preventivas@itguardian.local", "senha-restrita-123"));
  const list = await reader.get(base);
  assert.equal(list.status, 200);
  assert.ok(list.body.preventivePlans.length >= 1);
  const first = list.body.preventivePlans[0];
  assert.equal((await reader.get(`${base}/${first.id}`)).status, 200);
  assert.equal((await reader.get(`${base}/${first.id}/logs`)).status, 200);
  assert.equal((await reader.post(base, { name: "Proibido", assetIds: ["pp-a1"], scriptIds: [scripts.first.id] })).status, 403);
  assert.equal((await reader.post(`${base}/${first.id}/prepare`)).status, 403);
  assert.equal((await reader.post(`${base}/${first.id}/service-order`)).status, 403);

  await fx.createRestrictedUser({
    email: "sem-os-preventivas@itguardian.local",
    permissions: ["preventive_plans.view", "preventive_plans.create_service_order"]
  });
  const noOrders = fx.createClient(baseUrl, await fx.login(baseUrl, "sem-os-preventivas@itguardian.local", "senha-restrita-123"));
  assert.equal((await noOrders.post(`${base}/${first.id}/service-order`)).status, 403, "exige tambem service_orders.create");
});
