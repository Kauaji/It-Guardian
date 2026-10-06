import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "preventive-plans-integration-secret-with-32-characters";
process.env.NODE_ENV = "test";

const fx = await import("../test-support/preventiveFixtures.mjs");
const { closeDatabase } = await import("../src/database.js");

const base = fx.automationPath;
let api;
let baseUrl;
let scripts;
let server;

test.before(async () => {
  const holder = {
    after: (callback) => {
      server = callback;
    }
  };
  baseUrl = await fx.startServer(holder);
  api = fx.createClient(baseUrl, await fx.login(baseUrl));
  scripts = {
    first: await fx.createScript("Script preventivo um"),
    second: await fx.createScript("Script preventivo dois"),
    inactive: await fx.createScript("Script preventivo inativo", { active: false })
  };
  for (const machineId of ["agent-a1", "agent-a2", "agent-a3"]) {
    await fx.enrollAgentAsset(baseUrl, machineId);
  }
  await fx.assignSegment("agent-a1", "demo-segment-servers");
  await fx.assignSegment("agent-a2", "demo-segment-workstations");
  await fx.assignSegment("agent-a3", "demo-segment-workstations");
});

test.after(async () => {
  if (server) await server();
  await closeDatabase();
});

async function createPlan(payload, expectedStatus = 201) {
  const response = await api.post(base, { defaultScriptIds: [scripts.first.id], ...payload });
  assert.equal(response.status, expectedStatus, JSON.stringify(response.body));
  return response.body.preventiveAutomationPlan;
}

/**
 * O pg-mem ignora ROLLBACK: uma criacao que falha depois do INSERT do plano
 * deixa a linha para tras (no PostgreSQL real a transacao desfaz tudo).
 * Remove qualquer resquicio para que os testes sigam isolados nos dois bancos.
 */
async function purgePlansNamed(...names) {
  const listed = await api.get(base);
  for (const plan of listed.body.preventiveAutomationPlans) {
    if (names.includes(plan.name)) await api.del(`${base}/${plan.id}`);
  }
}

async function removePlan(plan) {
  const response = await api.del(`${base}/${plan.id}`);
  assert.equal(response.status, 200, JSON.stringify(response.body));
}

function activeAssetIds(plan) {
  return plan.assetSchedules
    .filter((schedule) => schedule.active)
    .map((schedule) => schedule.assetId)
    .sort();
}

test("cria plano asset_list com recorrencia propria por maquina e registra rastros", async () => {
  const plan = await createPlan({
    name: "Plano de lista explicita",
    scopeType: "asset_list",
    assetIds: ["agent-a1", " agent-a2 ", "agent-a1"],
    recurrenceType: "weekly",
    indicatorColor: "#AA3300",
    description: "  Descricao com espacos  ",
    overrides: [{ assetId: "agent-a2", recurrenceType: "custom_days", recurrenceIntervalDays: 5, preferredTime: "10:30" }]
  });

  assert.equal(plan.name, "Plano de lista explicita");
  assert.equal(plan.description, "Descricao com espacos");
  assert.equal(plan.active, true);
  assert.equal(plan.recurrenceType, "weekly");
  assert.equal(plan.recurrenceIntervalDays, 7);
  assert.equal(plan.preferredTime, "08:00");
  assert.equal(plan.timezone, "America/Sao_Paulo");
  assert.equal(plan.scopeType, "asset_list");
  assert.equal(plan.scopeId, null);
  assert.deepEqual(plan.assetIds, ["agent-a1", "agent-a2"]);
  assert.equal(plan.indicatorColor, "#aa3300");
  assert.equal(plan.createdByName, "Admin Sistema");
  assert.equal(plan.deletedAt, null);
  assert.deepEqual(plan.defaultScriptIds, [scripts.first.id]);
  assert.equal(plan.overrideCount, 1);
  assert.equal(plan.overrides[0].targetKey, "asset:agent-a2");
  assert.equal(plan.latestRun, null);
  assert.deepEqual(plan.recentRuns, []);

  const byAsset = Object.fromEntries(plan.assetSchedules.map((schedule) => [schedule.assetId, schedule]));
  assert.deepEqual(Object.keys(byAsset).sort(), ["agent-a1", "agent-a2"]);
  assert.equal(byAsset["agent-a2"].recurrenceSource, "machine");
  assert.equal(byAsset["agent-a2"].recurrenceType, "custom_days");
  assert.equal(byAsset["agent-a2"].recurrenceIntervalDays, 5);
  assert.equal(byAsset["agent-a2"].preferredTime, "10:30");
  assert.equal(byAsset["agent-a1"].recurrenceSource, "plan");
  assert.equal(byAsset["agent-a1"].recurrenceIntervalDays, 7);
  assert.ok(byAsset["agent-a1"].nextRunAt, "cada agenda precisa de proxima preparacao");
  assert.equal(plan.nextRunAt, [byAsset["agent-a1"].nextRunAt, byAsset["agent-a2"].nextRunAt].sort()[0]);

  const history = await fx.rows(
    "SELECT asset_id FROM asset_history WHERE event_type = 'preventive_automation_created' AND new_value = $1 ORDER BY asset_id",
    [plan.id]
  );
  assert.deepEqual(
    history.map((row) => row.asset_id),
    ["agent-a1", "agent-a2"]
  );

  const logs = await fx.rows("SELECT type, message FROM audit_logs WHERE meta->>'preventiveAutomationPlanId' = $1", [plan.id]);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].type, "preventive_automation_created");

  await removePlan(plan);
});

test("escopos segment, group, asset e all resolvem as maquinas esperadas", async () => {
  const manual = await fx.createManualDevice("Ativo manual do escopo", "SCOPE-MAN-1", "203.0.113.77");
  const created = [];
  try {
    const segmentPlan = await createPlan({
      name: "Plano por segmento",
      scopeType: "segment",
      scopeId: "demo-segment-workstations",
      indicatorColor: "#112233",
      assetIds: []
    });
    created.push(segmentPlan);
    assert.deepEqual(activeAssetIds(segmentPlan), ["agent-a2", "agent-a3"]);
    assert.equal(segmentPlan.scopeId, "demo-segment-workstations");

    const groupPlan = await createPlan({
      name: "Plano por grupo",
      scopeType: "group",
      scopeId: "demo-group-infra",
      indicatorColor: "#223344"
    });
    created.push(groupPlan);
    assert.deepEqual(activeAssetIds(groupPlan), ["agent-a1"]);

    const assetPlan = await createPlan({
      name: "Plano por ativo",
      scopeType: "asset",
      scopeId: "agent-a3",
      indicatorColor: "#334455"
    });
    created.push(assetPlan);
    assert.deepEqual(activeAssetIds(assetPlan), ["agent-a3"]);

    const allPlan = await createPlan({
      name: "Plano global",
      scopeType: "all",
      scopeId: "ignorado",
      excludedAssetIds: ["agent-a1"],
      indicatorColor: "#445566"
    });
    created.push(allPlan);
    assert.equal(allPlan.scopeId, null);
    assert.deepEqual(allPlan.excludedAssetIds, ["agent-a1"]);
    assert.deepEqual(activeAssetIds(allPlan), ["agent-a2", "agent-a3", manual.id].sort());
  } finally {
    for (const plan of created) await removePlan(plan);
  }
});

test("rejeita payloads invalidos com 400 e mensagens claras", async () => {
  const cases = [
    [{ name: "ab", scopeType: "all" }, /pelo menos 3 caracteres/],
    [{ name: "Plano sem escopo", scopeType: "segment" }, /Informe o escopo/],
    [{ name: "Plano segmento inexistente", scopeType: "segment", scopeId: "nao-existe" }, /escopo selecionado não existe/],
    [{ name: "Plano grupo inexistente", scopeType: "group", scopeId: "nao-existe" }, /escopo selecionado não existe/],
    [{ name: "Plano ativo inexistente", scopeType: "asset", scopeId: "nao-existe" }, /escopo selecionado não existe/],
    [{ name: "Plano lista ausente", scopeType: "asset_list" }, /assetIds deve ser uma lista/],
    [{ name: "Plano lista vazia", scopeType: "asset_list", assetIds: [] }, /pelo menos uma maquina/],
    [{ name: "Plano lista invalida", scopeType: "asset_list", assetIds: ["agent-a1", "fantasma"] }, /maquinas selecionadas nao existem/],
    [{ name: "Plano assetIds fora de lista", scopeType: "all", assetIds: ["agent-a1"] }, /so pode ser usado com o escopo asset_list/],
    [{ name: "Plano assetIds nao lista", scopeType: "all", assetIds: "agent-a1" }, /so pode ser usado com o escopo asset_list/],
    [{ name: "Plano sem scripts", scopeType: "all", defaultScriptIds: [] }, /pelo menos um script ativo/],
    [{ name: "Plano script inexistente", scopeType: "all", defaultScriptIds: ["script-fantasma"] }, /não existe ou está inativo/],
    [{ name: "Plano script inativo", scopeType: "all", defaultScriptIds: [scripts.inactive.id] }, /não existe ou está inativo/],
    [{ name: "Plano custom sem dias", scopeType: "all", recurrenceType: "custom_days" }, /quantidade de dias/],
    [
      {
        name: "Plano override ambiguo",
        scopeType: "all",
        overrides: [{ assetId: "agent-a1", segmentId: "demo-segment-servers" }]
      },
      /apenas uma máquina ou um segmento/
    ],
    [
      {
        name: "Plano override custom sem dias",
        scopeType: "all",
        overrides: [{ assetId: "agent-a1", recurrenceType: "custom_days" }]
      },
      /quantidade de dias/
    ]
  ];

  for (const [payload, pattern] of cases) {
    const response = await api.post(base, { defaultScriptIds: [scripts.first.id], ...payload });
    assert.equal(response.status, 400, `${payload.name}: ${JSON.stringify(response.body)}`);
    assert.match(response.body.message, pattern, payload.name);
  }

  const duplicated = await api.post(base, {
    name: "Plano override duplicado",
    scopeType: "all",
    indicatorColor: "#0f0f01",
    defaultScriptIds: [scripts.first.id],
    overrides: [
      { assetId: "agent-a1", recurrenceType: "weekly" },
      { assetId: "agent-a1", recurrenceType: "daily" }
    ]
  });
  assert.equal(duplicated.status, 409, JSON.stringify(duplicated.body));
  assert.match(duplicated.body.message, /já possui recorrência personalizada/);

  const duplicatedSegment = await api.post(base, {
    name: "Plano override segmento duplicado",
    scopeType: "all",
    indicatorColor: "#0f0f02",
    defaultScriptIds: [scripts.first.id],
    overrides: [
      { segmentId: "demo-segment-servers", recurrenceType: "weekly" },
      { segmentId: "demo-segment-servers", recurrenceType: "daily" }
    ]
  });
  assert.equal(duplicatedSegment.status, 409);
  assert.match(duplicatedSegment.body.message, /segmento já possui/);
  await purgePlansNamed("Plano override duplicado", "Plano override segmento duplicado");
});

test("escopo restrito sem maquinas disponiveis falha com 400", async () => {
  const response = await api.post(base, {
    name: "Plano segmento sem maquinas",
    scopeType: "segment",
    scopeId: "demo-segment-network",
    defaultScriptIds: [scripts.first.id]
  });
  assert.equal(response.status, 400, JSON.stringify(response.body));
  assert.match(response.body.message, /não possui máquinas disponíveis/);
});

test("nome e cor de indicador sao unicos entre planos nao excluidos", async () => {
  const plan = await createPlan({
    name: "Plano unico de identidade",
    scopeType: "asset",
    scopeId: "agent-a1",
    indicatorColor: "#654321"
  });

  const sameName = await api.post(base, {
    name: "PLANO UNICO DE IDENTIDADE",
    scopeType: "asset",
    scopeId: "agent-a1",
    indicatorColor: "#111111",
    defaultScriptIds: [scripts.first.id]
  });
  assert.equal(sameName.status, 409);
  assert.match(sameName.body.message, /Já existe uma automatização com esse nome/);

  const sameColor = await api.post(base, {
    name: "Outro plano de identidade",
    scopeType: "asset",
    scopeId: "agent-a1",
    indicatorColor: "#654321",
    defaultScriptIds: [scripts.first.id]
  });
  assert.equal(sameColor.status, 409);
  assert.match(sameColor.body.message, /cor #654321 já está sendo usada/);

  await removePlan(plan);

  const reused = await createPlan({
    name: "Plano unico de identidade",
    scopeType: "asset",
    scopeId: "agent-a1",
    indicatorColor: "#654321"
  });
  await removePlan(reused);
});

test("cor invalida volta para a cor padrao", async () => {
  const plan = await createPlan({
    name: "Plano com cor invalida",
    scopeType: "asset",
    scopeId: "agent-a1",
    indicatorColor: "vermelho"
  });
  assert.equal(plan.indicatorColor, "#1f7a61");
  await removePlan(plan);
});

test("edita plano, recalcula agendas somente quando a recorrencia muda e sincroniza maquinas", async () => {
  const plan = await createPlan({
    name: "Plano para editar",
    scopeType: "asset_list",
    assetIds: ["agent-a1", "agent-a2"],
    recurrenceType: "weekly",
    indicatorColor: "#778899"
  });
  const before = Object.fromEntries(plan.assetSchedules.map((schedule) => [schedule.assetId, schedule]));

  const description = await api.patch(`${base}/${plan.id}`, { description: "Nova descricao", notes: "Observacoes" });
  assert.equal(description.status, 200, JSON.stringify(description.body));
  const afterDescription = description.body.preventiveAutomationPlan;
  assert.equal(afterDescription.description, "Nova descricao");
  assert.equal(afterDescription.notes, "Observacoes");
  assert.equal(afterDescription.name, "Plano para editar");
  const unchanged = Object.fromEntries(afterDescription.assetSchedules.map((schedule) => [schedule.assetId, schedule]));
  assert.equal(unchanged["agent-a1"].nextRunAt, before["agent-a1"].nextRunAt, "agenda inalterada nao recalcula");
  assert.equal(unchanged["agent-a1"].id, before["agent-a1"].id);

  const recurrence = await api.patch(`${base}/${plan.id}`, {
    name: "Plano editado",
    recurrenceType: "daily",
    preferredTime: "06:15",
    timezone: "America/Manaus",
    indicatorColor: "#998877"
  });
  assert.equal(recurrence.status, 200, JSON.stringify(recurrence.body));
  const afterRecurrence = recurrence.body.preventiveAutomationPlan;
  assert.equal(afterRecurrence.name, "Plano editado");
  assert.equal(afterRecurrence.recurrenceType, "daily");
  assert.equal(afterRecurrence.recurrenceIntervalDays, 1);
  assert.equal(afterRecurrence.preferredTime, "06:15");
  assert.equal(afterRecurrence.timezone, "America/Manaus");
  assert.equal(afterRecurrence.indicatorColor, "#998877");
  for (const schedule of afterRecurrence.assetSchedules) {
    assert.equal(schedule.recurrenceType, "daily");
    assert.equal(schedule.preferredTime, "06:15");
    assert.equal(schedule.timezone, "America/Manaus");
    assert.notEqual(schedule.nextRunAt, before[schedule.assetId].nextRunAt);
  }

  const swap = await api.patch(`${base}/${plan.id}`, { assetIds: ["agent-a1", "agent-a3"] });
  assert.equal(swap.status, 200, JSON.stringify(swap.body));
  const swapped = swap.body.preventiveAutomationPlan;
  assert.deepEqual(swapped.assetIds, ["agent-a1", "agent-a3"]);
  const swappedSchedules = Object.fromEntries(swapped.assetSchedules.map((schedule) => [schedule.assetId, schedule]));
  assert.equal(swappedSchedules["agent-a2"].active, false, "maquina removida da lista fica com agenda inativa");
  assert.equal(swappedSchedules["agent-a3"].active, true);
  assert.equal(swappedSchedules["agent-a1"].active, true);

  const toSegment = await api.patch(`${base}/${plan.id}`, {
    scopeType: "segment",
    scopeId: "demo-segment-workstations",
    assetIds: []
  });
  assert.equal(toSegment.status, 200, JSON.stringify(toSegment.body));
  assert.deepEqual(activeAssetIds(toSegment.body.preventiveAutomationPlan), ["agent-a2", "agent-a3"]);

  const updates = await fx.rows(
    "SELECT DISTINCT asset_id FROM asset_history WHERE event_type = 'preventive_automation_updated' ORDER BY asset_id"
  );
  assert.ok(updates.length >= 2, "edicoes registram historico nas maquinas atingidas");

  await removePlan(plan);
});

test("edicao valida payload, existencia e identidade", async () => {
  const first = await createPlan({
    name: "Plano editavel um",
    scopeType: "asset",
    scopeId: "agent-a1",
    indicatorColor: "#abcdef"
  });
  const second = await createPlan({
    name: "Plano editavel dois",
    scopeType: "asset",
    scopeId: "agent-a2",
    indicatorColor: "#fedcba"
  });

  const missing = await api.patch(`${base}/plano-inexistente`, { description: "x" });
  assert.equal(missing.status, 404);

  const shortName = await api.patch(`${base}/${first.id}`, { name: "ab" });
  assert.equal(shortName.status, 400);

  const noScripts = await api.patch(`${base}/${first.id}`, { defaultScriptIds: [] });
  assert.equal(noScripts.status, 400);

  const nameConflict = await api.patch(`${base}/${first.id}`, { name: "plano editavel dois" });
  assert.equal(nameConflict.status, 409);
  assert.match(nameConflict.body.message, /Já existe uma automatização com esse nome/);

  const colorConflict = await api.patch(`${base}/${first.id}`, { indicatorColor: "#FEDCBA" });
  assert.equal(colorConflict.status, 409);
  assert.match(colorConflict.body.message, /já está sendo usada/);

  const sameIdentity = await api.patch(`${base}/${first.id}`, { name: "Plano editavel um", indicatorColor: "#abcdef" });
  assert.equal(sameIdentity.status, 200, "o proprio plano nao conflita consigo mesmo");

  await removePlan(first);
  await removePlan(second);
});

test("substitui overrides pela edicao e preserva quando o campo nao e enviado", async () => {
  const plan = await createPlan({
    name: "Plano de overrides em lote",
    scopeType: "asset_list",
    assetIds: ["agent-a1", "agent-a2"],
    recurrenceType: "monthly",
    indicatorColor: "#13579b",
    overrides: [{ assetId: "agent-a1", recurrenceType: "weekly" }]
  });
  assert.equal(plan.overrideCount, 1);

  const untouched = await api.patch(`${base}/${plan.id}`, { description: "sem overrides no payload" });
  assert.equal(untouched.body.preventiveAutomationPlan.overrides.length, 1);

  const replaced = await api.patch(`${base}/${plan.id}`, {
    overrides: [
      { assetId: "agent-a2", recurrenceType: "custom_days", recurrenceInterval: 3 },
      { segmentId: "demo-segment-servers", recurrenceType: "daily", active: false }
    ]
  });
  assert.equal(replaced.status, 200, JSON.stringify(replaced.body));
  const updated = replaced.body.preventiveAutomationPlan;
  assert.equal(updated.overrides.length, 2);
  assert.equal(updated.overrideCount, 1, "override inativo nao conta");
  const byAsset = Object.fromEntries(updated.assetSchedules.map((schedule) => [schedule.assetId, schedule]));
  assert.equal(byAsset["agent-a1"].recurrenceSource, "plan");
  assert.equal(byAsset["agent-a2"].recurrenceSource, "machine");
  assert.equal(byAsset["agent-a2"].recurrenceIntervalDays, 3);

  const cleared = await api.patch(`${base}/${plan.id}`, { overrides: [] });
  assert.equal(cleared.body.preventiveAutomationPlan.overrides.length, 0);

  await removePlan(plan);
});

test("pausa e reativacao dedicadas sincronizam agendas, historico e auditoria", async () => {
  const plan = await createPlan({
    name: "Plano para pausar",
    scopeType: "asset_list",
    assetIds: ["agent-a1", "agent-a3"],
    indicatorColor: "#2468ac"
  });

  const paused = await api.post(`${base}/${plan.id}/disable`);
  assert.equal(paused.status, 200, JSON.stringify(paused.body));
  const pausedPlan = paused.body.preventiveAutomationPlan;
  assert.equal(pausedPlan.active, false);
  assert.ok(pausedPlan.assetSchedules.every((schedule) => schedule.active === false));

  const pausedHistory = await fx.rows(
    "SELECT asset_id FROM asset_history WHERE event_type = 'preventive_automation_paused' AND message LIKE $1 ORDER BY asset_id",
    ["%Plano para pausar%"]
  );
  assert.deepEqual(
    pausedHistory.map((row) => row.asset_id),
    ["agent-a1", "agent-a3"]
  );

  const management = await api.get(`${base}/management`);
  const listed = management.body.plans.find((item) => item.id === plan.id);
  assert.equal(listed.active, false);
  assert.equal(listed.activeScheduleCount, 0);

  const reactivated = await api.post(`${base}/${plan.id}/reactivate`);
  assert.equal(reactivated.status, 200, JSON.stringify(reactivated.body));
  const reactivatedPlan = reactivated.body.preventiveAutomationPlan;
  assert.equal(reactivatedPlan.active, true);
  assert.ok(reactivatedPlan.assetSchedules.every((schedule) => schedule.active === true && schedule.nextRunAt));
  assert.ok(reactivatedPlan.nextRunAt);

  const events = await fx.rows("SELECT type FROM audit_logs WHERE meta->>'preventiveAutomationPlanId' = $1 ORDER BY created_at ASC", [
    plan.id
  ]);
  const types = events.map((row) => row.type);
  assert.ok(types.includes("preventive_automation_paused"));
  assert.ok(types.includes("preventive_automation_reactivated"));

  const viaPatch = await api.patch(`${base}/${plan.id}`, { active: false });
  assert.equal(viaPatch.body.preventiveAutomationPlan.active, false);
  const viaPatchHistory = await fx.rows(
    "SELECT message FROM asset_history WHERE asset_id = 'agent-a1' AND event_type = 'preventive_automation_paused' AND message LIKE $1",
    ["%Agenda desta máquina pausada%"]
  );
  assert.equal(viaPatchHistory.length, 1);
  const viaPatchBack = await api.patch(`${base}/${plan.id}`, { active: true });
  assert.equal(viaPatchBack.body.preventiveAutomationPlan.active, true);

  assert.equal((await api.post(`${base}/inexistente/disable`)).status, 404);
  assert.equal((await api.post(`${base}/inexistente/reactivate`)).status, 404);

  await removePlan(plan);
});

test("exclusao e logica: preserva auditoria, desativa agendas e bloqueia novas acoes", async () => {
  const plan = await createPlan({
    name: "Plano para excluir",
    scopeType: "asset_list",
    assetIds: ["agent-a1", "agent-a2"],
    indicatorColor: "#369cf0"
  });

  const removed = await api.del(`${base}/${plan.id}`);
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  const result = removed.body.preventiveAutomationPlan;
  assert.equal(result.active, false);
  assert.ok(result.deletedAt);
  assert.equal(result.affectedAssetCount, 2);

  const stored = await fx.rows("SELECT active, deleted_at FROM preventive_automation_plans WHERE id = $1", [plan.id]);
  assert.equal(stored.length, 1, "a linha continua no banco");
  assert.equal(stored[0].active, false);
  assert.ok(stored[0].deleted_at);
  const schedules = await fx.rows("SELECT active FROM preventive_automation_asset_schedules WHERE plan_id = $1", [plan.id]);
  assert.equal(schedules.length, 2);
  assert.ok(schedules.every((row) => row.active === false));

  const audit = await fx.rows("SELECT meta FROM audit_logs WHERE type = 'preventive_automation_deleted' AND meta->>'planId' = $1", [
    plan.id
  ]);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].meta.affectedAssetCount, 2);

  assert.equal((await api.get(`${base}/${plan.id}`)).status, 404);
  assert.equal((await api.del(`${base}/${plan.id}`)).status, 404);
  assert.equal((await api.post(`${base}/${plan.id}/reactivate`)).status, 404);
  assert.equal((await api.post(`${base}/${plan.id}/disable`)).status, 404);
  assert.equal((await api.patch(`${base}/${plan.id}`, { description: "x" })).status, 404);
  assert.equal((await api.post(`${base}/${plan.id}/prepare`)).status, 404);

  const history = await api.get(`${base}/${plan.id}/history`);
  assert.equal(history.status, 404, "historico de plano excluido nao e exposto pela API");

  const listed = await api.get(base);
  assert.ok(!listed.body.preventiveAutomationPlans.some((item) => item.id === plan.id));
});

test("lista com paginacao e detalhe devolvem planos hidratados", async () => {
  const one = await createPlan({ name: "Plano paginado um", scopeType: "asset", scopeId: "agent-a1", indicatorColor: "#010203" });
  const two = await createPlan({ name: "Plano paginado dois", scopeType: "asset", scopeId: "agent-a2", indicatorColor: "#040506" });

  const all = await api.get(base);
  assert.equal(all.status, 200);
  const ids = all.body.preventiveAutomationPlans.map((item) => item.id);
  assert.ok(ids.includes(one.id) && ids.includes(two.id));
  assert.ok(all.body.preventiveAutomationPlans.every((item) => Array.isArray(item.assetSchedules)));

  const pageOne = await api.get(`${base}?limit=1&offset=0`);
  const pageTwo = await api.get(`${base}?limit=1&offset=1`);
  assert.equal(pageOne.body.preventiveAutomationPlans.length, 1);
  assert.equal(pageTwo.body.preventiveAutomationPlans.length, 1);
  assert.notEqual(pageOne.body.preventiveAutomationPlans[0].id, pageTwo.body.preventiveAutomationPlans[0].id);

  const invalidPaging = await api.get(`${base}?limit=abc&offset=-3`);
  assert.equal(invalidPaging.status, 200);
  assert.ok(invalidPaging.body.preventiveAutomationPlans.length >= 2, "valores invalidos usam o padrao");

  const detail = await api.get(`${base}/${one.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.preventiveAutomationPlan.id, one.id);
  assert.equal(detail.body.preventiveAutomationPlan.assetSchedules.length, 1);

  await removePlan(one);
  await removePlan(two);
});

test("historico do plano lista eventos de auditoria mais recentes primeiro e respeita o limite", async () => {
  const plan = await createPlan({ name: "Plano com historico", scopeType: "asset", scopeId: "agent-a1", indicatorColor: "#0a0b0c" });
  await api.patch(`${base}/${plan.id}`, { description: "mudanca 1" });
  await api.post(`${base}/${plan.id}/disable`);

  const history = await api.get(`${base}/${plan.id}/history`);
  assert.equal(history.status, 200);
  assert.equal(history.body.limit, 50);
  const types = history.body.items.map((item) => item.type);
  assert.deepEqual(types.slice(0, 3), ["preventive_automation_paused", "preventive_automation_updated", "preventive_automation_created"]);
  assert.equal(history.body.items[0].userName, "Admin Sistema");

  const limited = await api.get(`${base}/${plan.id}/history?limit=1`);
  assert.equal(limited.body.items.length, 1);
  assert.equal(limited.body.limit, 1);

  const capped = await api.get(`${base}/${plan.id}/history?limit=9999`);
  assert.equal(capped.body.limit, 100);

  assert.equal((await api.get(`${base}/inexistente/history`)).status, 404);
  await removePlan(plan);
});

test("rotas exigem sessao e permissao especifica", async () => {
  assert.equal((await fx.createClient(baseUrl, "").get(base)).status, 401);

  await fx.createRestrictedUser({
    email: "so-leitura-automacao@itguardian.local",
    permissions: ["preventive_automation.view"]
  });
  const readerCookie = await fx.login(baseUrl, "so-leitura-automacao@itguardian.local", "senha-restrita-123");
  const reader = fx.createClient(baseUrl, readerCookie);

  assert.equal((await reader.get(base)).status, 200);
  assert.equal((await reader.get(`${base}/management`)).status, 200);
  assert.equal((await reader.get(`${base}/agenda`)).status, 200);
  assert.equal((await reader.post(base, { name: "Plano proibido", scopeType: "all", defaultScriptIds: [scripts.first.id] })).status, 403);
  assert.equal((await reader.post(`${base}/process-due`)).status, 403);
  assert.equal((await reader.patch(`${base}/qualquer`, {})).status, 403);
  assert.equal((await reader.post(`${base}/qualquer/disable`)).status, 403);
  assert.equal((await reader.post(`${base}/qualquer/reactivate`)).status, 403);
  assert.equal((await reader.del(`${base}/qualquer`)).status, 403);
  assert.equal((await reader.post(`${base}/qualquer/prepare`)).status, 403);
  assert.equal((await reader.del(`${base}/qualquer/assets/agent-a1`)).status, 403);
  assert.equal((await reader.put(`${base}/qualquer/assets/agent-a1/override`, {})).status, 403);
  assert.equal((await reader.del(`${base}/qualquer/assets/agent-a1/override`)).status, 403);
});
