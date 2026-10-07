import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "preventive-scope-integration-secret-with-32-chars";
process.env.NODE_ENV = "test";

const fx = await import("../test-support/preventiveFixtures.mjs");
const { closeDatabase } = await import("../src/database.js");

const base = fx.automationPath;
const password = "senha-restrita-123";
const allAutomationPermissions = [
  "preventive_automation.view",
  "preventive_automation.create",
  "preventive_automation.update",
  "preventive_automation.disable",
  "preventive_automation.delete",
  "preventive_automation.run_prepare",
  "preventive_automation.remove_asset",
  "preventive_automation.manage_asset_override"
];

let admin;
let ownerOne;
let ownerTwo;
let bounded;
let boundedUserId;
let closeServer;
let scripts;
let adminPlan;
let ownerPlan;

async function clientFor(baseUrl, email) {
  return fx.createClient(baseUrl, await fx.login(baseUrl, email, password));
}

test.before(async () => {
  const holder = {
    after: (callback) => {
      closeServer = callback;
    }
  };
  const baseUrl = await fx.startServer(holder);
  admin = fx.createClient(baseUrl, await fx.login(baseUrl));
  scripts = { first: await fx.createScript("Script de escopo") };
  for (const machineId of ["sc-a1", "sc-a2"]) await fx.enrollAgentAsset(baseUrl, machineId);
  await fx.assignSegment("sc-a1", "demo-segment-servers");
  await fx.assignSegment("sc-a2", "demo-segment-workstations");

  await fx.createRestrictedUser({ email: "dono-um@itguardian.local", permissions: allAutomationPermissions, name: "Dono Um" });
  await fx.createRestrictedUser({ email: "dono-dois@itguardian.local", permissions: allAutomationPermissions, name: "Dono Dois" });
  const boundedUser = await fx.createRestrictedUser({
    email: "tecnico-limitado@itguardian.local",
    permissions: allAutomationPermissions,
    name: "Tecnico Limitado"
  });
  boundedUserId = boundedUser.id;
  await fx.rows("INSERT INTO technicians (id, name, email, active, allowed_client_ids) VALUES ($1, $2, $3, TRUE, $4::jsonb)", [
    randomUUID(),
    "Tecnico Limitado",
    "tecnico-limitado@itguardian.local",
    JSON.stringify(["cliente-restrito"])
  ]);

  ownerOne = await clientFor(baseUrl, "dono-um@itguardian.local");
  ownerTwo = await clientFor(baseUrl, "dono-dois@itguardian.local");
  bounded = await clientFor(baseUrl, "tecnico-limitado@itguardian.local");

  const adminCreated = await admin.post(base, {
    name: "Plano criado pelo administrador",
    scopeType: "asset",
    scopeId: "sc-a1",
    defaultScriptIds: [scripts.first.id],
    indicatorColor: "#aa0001"
  });
  assert.equal(adminCreated.status, 201, JSON.stringify(adminCreated.body));
  adminPlan = adminCreated.body.preventiveAutomationPlan;

  const ownerCreated = await ownerOne.post(base, {
    name: "Plano criado pelo dono um",
    scopeType: "asset_list",
    assetIds: ["sc-a1", "sc-a2"],
    defaultScriptIds: [scripts.first.id],
    indicatorColor: "#aa0002"
  });
  assert.equal(ownerCreated.status, 201, JSON.stringify(ownerCreated.body));
  ownerPlan = ownerCreated.body.preventiveAutomationPlan;
});

test.after(async () => {
  if (closeServer) await closeServer();
  await closeDatabase();
});

test("usuario comum enxerga apenas os planos que criou; administrador enxerga todos", async () => {
  const mine = await ownerOne.get(base);
  assert.deepEqual(
    mine.body.preventiveAutomationPlans.map((plan) => plan.id),
    [ownerPlan.id]
  );

  const others = await ownerTwo.get(base);
  assert.deepEqual(others.body.preventiveAutomationPlans, []);

  const everything = await admin.get(base);
  const ids = everything.body.preventiveAutomationPlans.map((plan) => plan.id);
  assert.ok(ids.includes(adminPlan.id) && ids.includes(ownerPlan.id));

  const page = await ownerOne.get(`${base}?limit=1&offset=1`);
  assert.deepEqual(page.body.preventiveAutomationPlans, []);

  assert.equal((await ownerOne.get(`${base}/${ownerPlan.id}`)).status, 200);
  assert.equal((await ownerOne.get(`${base}/${adminPlan.id}`)).status, 404);
  assert.equal((await ownerTwo.get(`${base}/${ownerPlan.id}`)).status, 404);
});

test("gerenciamento e agenda aplicam o escopo antes de contar e paginar", async () => {
  const management = await ownerOne.get(`${base}/management`);
  assert.deepEqual(
    management.body.plans.map((plan) => plan.id),
    [ownerPlan.id]
  );
  assert.equal(management.body.pagination.total, 1);
  assert.deepEqual(management.body.machines.map((machine) => machine.assetId).sort(), ["sc-a1", "sc-a2"]);

  const empty = await ownerTwo.get(`${base}/management`);
  assert.deepEqual(empty.body, { plans: [], machines: [], metadata: { planCount: 0, machineCount: 0 } });

  const agenda = await ownerOne.get(`${base}/agenda`);
  assert.ok(agenda.body.items.length >= 2);
  assert.ok(agenda.body.items.every((item) => item.planId === ownerPlan.id));
  assert.equal(agenda.body.pagination.total, agenda.body.items.length);

  const foreignPlan = await ownerOne.get(`${base}/agenda?planId=${adminPlan.id}`);
  assert.deepEqual(foreignPlan.body.items, []);
  assert.equal(foreignPlan.body.pagination.total, 0);

  const emptyAgenda = await ownerTwo.get(`${base}/agenda`);
  assert.deepEqual(emptyAgenda.body.items, []);
  assert.equal(emptyAgenda.body.pagination.hasMore, false);

  const adminAgenda = await admin.get(`${base}/agenda`);
  const planIds = new Set(adminAgenda.body.items.map((item) => item.planId));
  assert.ok(planIds.has(adminPlan.id) && planIds.has(ownerPlan.id));
});

test("mutacoes e leituras de plano alheio respondem 404 sem vazar dados", async () => {
  const foreign = `${base}/${adminPlan.id}`;
  assert.equal((await ownerOne.patch(foreign, { description: "invasao" })).status, 404);
  assert.equal((await ownerOne.post(`${foreign}/disable`)).status, 404);
  assert.equal((await ownerOne.post(`${foreign}/reactivate`)).status, 404);
  assert.equal((await ownerOne.del(foreign)).status, 404);
  assert.equal((await ownerOne.post(`${foreign}/prepare`)).status, 404);
  assert.equal((await ownerOne.get(`${foreign}/history`)).status, 404);
  assert.equal((await ownerOne.get(`${foreign}/assets/sc-a1`)).status, 404);
  assert.equal((await ownerOne.put(`${foreign}/assets/sc-a1/override`, { recurrenceType: "daily" })).status, 404);
  assert.equal((await ownerOne.del(`${foreign}/assets/sc-a1/override`)).status, 404);
  assert.equal((await ownerOne.del(`${foreign}/assets/sc-a1`)).status, 404);

  const untouched = (await admin.get(foreign)).body.preventiveAutomationPlan;
  assert.equal(untouched.active, true);
  assert.equal(untouched.description, "");
});

test("dono do plano administra o proprio plano de ponta a ponta", async () => {
  const own = `${base}/${ownerPlan.id}`;
  assert.equal((await ownerOne.patch(own, { description: "minha descricao" })).status, 200);
  assert.equal((await ownerOne.get(`${own}/history`)).status, 200);
  assert.equal((await ownerOne.get(`${own}/assets/sc-a1`)).status, 200);
  assert.equal((await ownerOne.put(`${own}/assets/sc-a1/override`, { recurrenceType: "daily" })).status, 200);
  assert.equal((await ownerOne.del(`${own}/assets/sc-a1/override`)).status, 200);
  assert.equal((await ownerOne.post(`${own}/disable`)).status, 200);
  assert.equal((await ownerOne.post(`${own}/reactivate`)).status, 200);
  assert.equal((await ownerOne.del(`${own}/assets/sc-a2`)).status, 200);
});

test("usuario com escopo delimitado nao enxerga nem automatiza maquinas fora do escopo", async () => {
  const blocked = await bounded.post(base, {
    name: "Plano fora do escopo",
    scopeType: "all",
    defaultScriptIds: [scripts.first.id],
    indicatorColor: "#aa0003"
  });
  assert.equal(blocked.status, 403, JSON.stringify(blocked.body));
  assert.match(blocked.body.message, /não possui máquinas autorizadas para este usuário/);

  const blockedList = await bounded.post(base, {
    name: "Plano de lista fora do escopo",
    scopeType: "asset_list",
    assetIds: ["sc-a1"],
    defaultScriptIds: [scripts.first.id],
    indicatorColor: "#aa0004"
  });
  assert.equal(blockedList.status, 403);

  // Plano do proprio usuario continua visivel, mas as maquinas dele ficam inacessiveis.
  const ownId = randomUUID();
  await fx.rows(
    `
      INSERT INTO preventive_automation_plans (
        id, name, scope_type, scope_id, default_script_ids, indicator_color, created_by,
        next_run_at, schedule_anchor_at, last_scheduled_at
      )
      VALUES ($1, 'Plano legado do tecnico limitado', 'asset', 'sc-a2', $2, '#aa0005', $3, NOW(), NOW(), NOW())
    `,
    [ownId, JSON.stringify([scripts.first.id]), boundedUserId]
  );
  await fx.rows(
    `
      INSERT INTO preventive_automation_asset_schedules (id, plan_id, asset_id, next_run_at)
      VALUES ($1, $2, 'sc-a2', NOW())
    `,
    [randomUUID(), ownId]
  );

  const list = await bounded.get(base);
  assert.deepEqual(
    list.body.preventiveAutomationPlans.map((plan) => plan.id),
    [ownId]
  );
  assert.equal((await bounded.get(`${base}/${ownId}`)).status, 200);
  assert.equal((await bounded.get(`${base}/${ownId}/assets/sc-a2`)).status, 404, "ativo fora do escopo do usuario");

  const preparedByOwner = await bounded.post(`${base}/${ownId}/prepare`);
  assert.equal(preparedByOwner.status, 200, "preparo valida o plano, nao o escopo da maquina");

  await fx.rows("DELETE FROM preventive_automation_plans WHERE id = $1", [ownId]);
});
