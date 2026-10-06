import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

// Caracteriza o ciclo de vida completo das plantas (criar, atualizar, salvar o
// editor, duplicar, vincular ativo, fundo e excluir) antes da divisao do
// antigo repositories/floorPlanRepository.js em dominio/repositorio/servico.

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "floor-plan-lifecycle-secret-with-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");
const { listLogs } = await import("../src/repositories/logRepository.js");
const { listAssetHistory } = await import("../src/repositories/assetHistoryRepository.js");
const { listen, login, browserHeaders } = await import("../test-support/scriptFixtures.mjs");

test.after(closeDatabase);

async function api(baseUrl, cookie, method, path, body) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: browserHeaders(cookie),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

test("planta: criar normaliza payload, atualizar preserva campos, editor substitui filhos e duplicar remapeia ids", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  // floor_plans.inventory_tab_id e apenas um texto (a tabela inventory_tabs nao existe mais).
  const tabId = "aba-caracterizacao";

  const created = await api(baseUrl, cookie, "POST", "/floor-plans", {
    name: "  Planta A  ",
    company: "ACME",
    status: "inexistente",
    width: 50,
    height: 99999,
    gridSize: "abc",
    inventoryTabId: tabId,
    floorLabel: "Térreo"
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const bundle = created.body.plan;
  assert.equal(bundle.plan.name, "Planta A");
  assert.equal(bundle.plan.status, "draft");
  assert.equal(bundle.plan.width, 400);
  assert.equal(bundle.plan.height, 12000);
  assert.equal(bundle.plan.gridSize, 25);
  assert.equal(bundle.plan.inventoryTabId, tabId);
  assert.equal(bundle.floors.length, 1);
  assert.equal(bundle.floors[0].name, "Térreo");
  assert.equal(bundle.plan.activeFloorId, bundle.floors[0].id);
  assert.equal(bundle.plan.floorCount, 1);
  const planId = bundle.plan.id;
  const floorId = bundle.floors[0].id;

  const duplicateTab = await api(baseUrl, cookie, "POST", "/floor-plans", { name: "Outra", inventoryTabId: tabId });
  assert.equal(duplicateTab.status, 409);
  const listedByTab = await api(baseUrl, cookie, "GET", `/floor-plans?inventoryTabId=${tabId}`);
  assert.deepEqual(
    listedByTab.body.plans.map((plan) => plan.id),
    [planId]
  );
  assert.equal((await api(baseUrl, cookie, "GET", "/floor-plans/nao-existe")).status, 404);

  const updated = await api(baseUrl, cookie, "PATCH", `/floor-plans/${planId}`, { name: "Planta A2", status: "active", gridSize: 40 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.plan.plan.name, "Planta A2");
  assert.equal(updated.body.plan.plan.status, "active");
  assert.equal(updated.body.plan.plan.company, "ACME", "campos nao enviados sao preservados");
  assert.equal(updated.body.plan.plan.gridSize, 40);
  assert.equal(updated.body.plan.plan.width, 400);

  const saved = await api(baseUrl, cookie, "PATCH", `/floor-plans/${planId}/editor-data`, {
    floors: [
      { id: floorId, name: "Térreo", level: 1 },
      { id: "andar-2", name: "Primeiro andar", level: 2 }
    ],
    zones: [
      { id: "zona-1", floorId: "andar-2", zoneType: "segment", name: "Seg", geometry: { x: 1, y: 2, width: 30, height: 40 } },
      { id: "zona-x", floorId: "andar-inexistente", zoneType: "invalida", name: "", geometry: { x: 0, y: 0, width: 10, height: 10 } }
    ],
    objects: [
      { id: "obj-1", floorId, objectType: "server", label: "Servidor", x: 10, y: 20, width: 80, height: 50, metadata: { a: 1 } },
      { id: "obj-2", floorId: "andar-2", label: "PC", x: 30, y: 40 }
    ],
    connectionPoints: [
      { id: "pt-1", floorId, pointType: "network", label: "RJ45", linkedObjectId: "obj-1", x: 5, y: 5 },
      { id: "pt-2", floorId, pointType: "power", label: "Tomada", x: 50, y: 50 }
    ],
    cableRoutes: [
      {
        id: "rt-1",
        floorId,
        routeType: "network",
        label: "Cabo 1",
        color: "#112233",
        sourcePointId: "pt-1",
        targetPointId: "pt-2",
        path: [
          { x: 5, y: 5 },
          { x: 50, y: 50 }
        ]
      }
    ]
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const editor = saved.body.plan;
  assert.deepEqual(editor.floors.map((floor) => floor.id).sort(), [floorId, "andar-2"].sort());
  const zones = Object.fromEntries(editor.zones.map((zone) => [zone.id, zone]));
  assert.equal(zones["zona-1"].floorId, "andar-2");
  assert.equal(zones["zona-x"].floorId, floorId, "andar invalido cai no primeiro andar");
  assert.equal(zones["zona-x"].zoneType, "room");
  assert.equal(zones["zona-x"].name, "Ambiente");
  assert.equal(editor.objects.length, 2);
  assert.equal(editor.objects.find((item) => item.id === "obj-2").width, 88);
  assert.equal(editor.connectionPoints.length, 2);
  assert.equal(editor.cableRoutes[0].sourcePointId, "pt-1");
  assert.equal(editor.plan.objectCount, 2);
  assert.equal(editor.plan.floorCount, 2);

  // pontos e rotas sem label/cor usam padroes (antes falhava com 500 por NOT NULL)
  const withDefaults = await api(baseUrl, cookie, "PATCH", `/floor-plans/${planId}/editor-data`, {
    floors: editor.floors,
    zones: editor.zones,
    objects: editor.objects,
    connectionPoints: [
      { id: "pt-a", floorId, pointType: "power", x: 1, y: 1 },
      { id: "pt-b", floorId, x: 2, y: 2 }
    ],
    cableRoutes: [{ id: "rt-a", floorId, routeType: "network", sourcePointId: "pt-a", targetPointId: "pt-b" }]
  });
  assert.equal(withDefaults.status, 200, JSON.stringify(withDefaults.body));
  assert.deepEqual(withDefaults.body.plan.connectionPoints.map((point) => point.label).sort(), ["Ponto de rede", "Tomada"]);
  assert.equal(withDefaults.body.plan.cableRoutes[0].label, "Cabo de rede");
  assert.equal(withDefaults.body.plan.cableRoutes[0].color, "#2563eb");
  const restored = await api(baseUrl, cookie, "PATCH", `/floor-plans/${planId}/editor-data`, {
    floors: editor.floors,
    zones: editor.zones,
    objects: editor.objects,
    connectionPoints: editor.connectionPoints,
    cableRoutes: editor.cableRoutes
  });
  assert.equal(restored.status, 200, JSON.stringify(restored.body));

  const invalidEditor = await api(baseUrl, cookie, "PATCH", `/floor-plans/${planId}/editor-data`, {
    floors: [{ id: floorId, name: "Térreo" }],
    objects: [
      { id: "obj-1", floorId, label: "A" },
      { id: "obj-1", floorId, label: "Repetido" }
    ]
  });
  assert.equal(invalidEditor.status, 400, JSON.stringify(invalidEditor.body));
  const unchanged = await api(baseUrl, cookie, "GET", `/floor-plans/${planId}`);
  assert.equal(unchanged.body.plan.objects.length, 2, "editor invalido nao altera a planta (transacao)");

  const linked = await api(baseUrl, cookie, "PATCH", "/floor-plans/objects/obj-1/link-equipment", {
    assetId: "ativo-caracterizacao",
    label: "Servidor vinculado"
  });
  assert.equal(linked.status, 200, JSON.stringify(linked.body));
  assert.equal(linked.body.object.linkedAssetId, "ativo-caracterizacao");
  assert.equal(linked.body.object.segmentId, null);
  assert.equal(linked.body.object.label, "Servidor vinculado");
  const kept = await api(baseUrl, cookie, "PATCH", "/floor-plans/objects/obj-1/link-equipment", { assetId: "ativo-caracterizacao" });
  assert.equal(kept.body.object.label, "Servidor vinculado", "label ausente preserva o atual");
  assert.equal((await api(baseUrl, cookie, "PATCH", "/floor-plans/objects/nao-existe/link-equipment", {})).status, 404);
  const assetEvents = await listAssetHistory("ativo-caracterizacao");
  assert.ok(assetEvents.some((event) => event.eventType === "floor_plan_linked" && event.newValue === "obj-1"));

  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const upload = await fetch(`${baseUrl}/api/floor-plans/${planId}/floors/${floorId}/background`, {
    method: "POST",
    headers: { cookie, origin: "http://localhost:5173", "content-type": "image/png", "x-file-name": "fundo.png" },
    body: png
  });
  assert.equal(upload.status, 201);
  const wrongFloor = await fetch(`${baseUrl}/api/floor-plans/${planId}/floors/andar-nenhum/background`, {
    method: "POST",
    headers: { cookie, origin: "http://localhost:5173", "content-type": "image/png" },
    body: png
  });
  assert.equal(wrongFloor.status, 404);

  const copy = await api(baseUrl, cookie, "POST", `/floor-plans/${planId}/duplicate`);
  assert.equal(copy.status, 201, JSON.stringify(copy.body));
  const copyBundle = copy.body.plan;
  assert.notEqual(copyBundle.plan.id, planId);
  assert.equal(copyBundle.plan.name, "Planta A2 - copia");
  assert.equal(copyBundle.plan.status, "draft");
  assert.equal(copyBundle.plan.inventoryTabId, null);
  assert.equal(copyBundle.floors.length, 2);
  assert.equal(copyBundle.objects.length, 2);
  assert.equal(copyBundle.zones.length, 2);
  const copyFloorIds = new Set(copyBundle.floors.map((floor) => floor.id));
  assert.ok(![floorId, "andar-2"].some((id) => copyFloorIds.has(id)), "andares recebem ids novos");
  assert.ok(copyBundle.objects.every((object) => copyFloorIds.has(object.floorId) && object.id !== "obj-1" && object.id !== "obj-2"));
  const copyPoint = copyBundle.connectionPoints.find((point) => point.linkedObjectId);
  assert.ok(copyPoint && copyBundle.objects.some((object) => object.id === copyPoint.linkedObjectId));
  const copyRoute = copyBundle.cableRoutes[0];
  assert.ok(copyBundle.connectionPoints.some((point) => point.id === copyRoute.sourcePointId));
  assert.ok(copyBundle.connectionPoints.some((point) => point.id === copyRoute.targetPointId));
  assert.equal(copyBundle.objects.find((object) => object.label === "Servidor vinculado").linkedAssetId, "ativo-caracterizacao");

  const removedBackground = await fetch(`${baseUrl}/api/floor-plans/${planId}/floors/${floorId}/background`, {
    method: "DELETE",
    headers: browserHeaders(cookie)
  });
  assert.equal(removedBackground.status, 200);
  const missing = await fetch(`${baseUrl}/api/floor-plans/${planId}/floors/${floorId}/background`, { headers: { cookie } });
  assert.equal(missing.status, 404);

  const removed = await api(baseUrl, cookie, "DELETE", `/floor-plans/${copyBundle.plan.id}`);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.plan.id, copyBundle.plan.id);
  assert.equal((await api(baseUrl, cookie, "GET", `/floor-plans/${copyBundle.plan.id}`)).status, 404);
  assert.equal((await api(baseUrl, cookie, "DELETE", `/floor-plans/${copyBundle.plan.id}`)).status, 404);

  const logTypes = (await listLogs()).map((log) => log.type);
  for (const expected of [
    "floor_plan.created",
    "floor_plan.updated",
    "floor_plan.editor_saved",
    "floor_plan.object_linked",
    "floor_plan.duplicated",
    "floor_plan.deleted",
    "floor_plan.background_uploaded",
    "floor_plan.background_removed"
  ]) {
    assert.ok(logTypes.includes(expected), `log ${expected} ausente`);
  }
});
