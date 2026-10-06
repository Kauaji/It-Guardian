import assert from "node:assert/strict";
import test from "node:test";
import { floorPlanBackgroundUrl, validateFloorPlanBackground } from "./floorPlanBackground.js";
import {
  assertAssetHeatmapMetric,
  assetHeatmapSeverity,
  assetSnapshot,
  buildAssetHeatmap,
  buildInfrastructureSummary,
  buildServiceOrderHeatmap,
  parseHeatmapPeriod
} from "./floorPlanInfrastructure.js";
import {
  normalizeEditorChildren,
  normalizeEditorData,
  normalizePlanPayload,
  planFloorPlanDuplicate,
  resolveActiveFloorId
} from "./floorPlanPayload.js";

test("plano: limita numeros, ignora status invalido e preserva campos existentes", () => {
  const plan = normalizePlanPayload({ name: "  ", status: "xyz", width: 1, height: 99999, gridSize: "abc", snap_size: 0 });
  assert.equal(plan.name, "Planta sem nome");
  assert.equal(plan.status, "draft");
  assert.equal(plan.width, 400);
  assert.equal(plan.height, 12000);
  assert.equal(plan.gridSize, 25);
  assert.equal(plan.snapSize, 1);
  const kept = normalizePlanPayload({ gridSize: 40 }, { name: "Atual", status: "active", company: "ACME", width: 2000 });
  assert.equal(kept.name, "Atual");
  assert.equal(kept.status, "active");
  assert.equal(kept.company, "ACME");
  assert.equal(kept.width, 2000);
  assert.equal(kept.gridSize, 40);
});

test("editor: andar padrao, filhos com andar invalido caem no primeiro e ids sao gerados", () => {
  const plan = normalizePlanPayload({ floorLabel: "Térreo", width: 1000, height: 600 });
  const data = normalizeEditorData({}, plan);
  assert.equal(data.floors.length, 1);
  assert.equal(data.floors[0].name, "Térreo");
  assert.equal(data.floors[0].width, 1000);
  assert.deepEqual(data.objects, []);

  const children = normalizeEditorChildren("p1", {
    floors: [
      { id: "f1", name: "A", width: 800, height: 600 },
      { id: "f2", name: "B", width: 800, height: 600 }
    ],
    zones: [{ floorId: "f9", zoneType: "x", geometry: { x: 0, y: 0, width: 10, height: 10 } }],
    objects: [{ floorId: "f2", label: " PC " }, { floor_id: "inexistente" }],
    connection_points: [{ pointType: "invalido", label: "R" }],
    cable_routes: [{ route_type: "power", label: "C", color: "#123456", path: "nao-lista" }]
  });
  assert.equal(children.fallbackFloorId, "f1");
  assert.equal(children.zones[0].floorId, "f1");
  assert.equal(children.zones[0].zoneType, "room");
  assert.ok(children.zones[0].id);
  assert.equal(children.objects[0].floorId, "f2");
  assert.equal(children.objects[0].label, "PC");
  assert.equal(children.objects[1].floorId, "f1");
  assert.equal(children.objects[1].width, 88);
  assert.equal(children.connectionPoints[0].pointType, "network");
  assert.equal(children.cableRoutes[0].routeType, "power");
  assert.deepEqual(children.cableRoutes[0].path, []);
});

test("editor: entradas nulas nas listas cruas sao descartadas em vez de lancar TypeError", () => {
  const plan = normalizePlanPayload({ floorLabel: "Térreo" });
  const onlyNullFloors = normalizeEditorData({ floors: [null] }, plan);
  assert.equal(onlyNullFloors.floors.length, 1, "sem andar valido, cai no andar padrao");
  assert.equal(onlyNullFloors.floors[0].name, "Térreo");

  const children = normalizeEditorChildren("p1", {
    floors: [{ id: "f1", name: "A", width: 800, height: 600 }],
    zones: [null, { geometry: { x: 0, y: 0, width: 10, height: 10 } }],
    objects: [null, { label: "PC" }],
    connectionPoints: [null],
    cableRoutes: [null]
  });
  assert.equal(children.zones.length, 1);
  assert.equal(children.objects.length, 1);
  assert.equal(children.objects[0].label, "PC");
  assert.deepEqual(children.connectionPoints, []);
  assert.deepEqual(children.cableRoutes, []);
});

test("pontos e rotas sem label/cor recebem padroes (colunas NOT NULL) em vez de falhar no banco", () => {
  const children = normalizeEditorChildren("p1", {
    floors: [{ id: "f1", name: "A", width: 800, height: 600 }],
    connectionPoints: [{ pointType: "power" }, {}],
    cableRoutes: [{ routeType: "power" }, {}]
  });
  assert.deepEqual(
    children.connectionPoints.map((point) => point.label),
    ["Tomada", "Ponto de rede"]
  );
  assert.deepEqual(
    children.cableRoutes.map((route) => route.label),
    ["Cabo de energia", "Cabo de rede"]
  );
  assert.deepEqual(
    children.cableRoutes.map((route) => route.color),
    ["#2563eb", "#2563eb"]
  );
});

test("andar ativo e a copia de planta remapeiam ids e referencias", () => {
  const floors = [{ id: "a" }, { id: "b" }];
  assert.equal(resolveActiveFloorId({ activeFloorId: "b" }, floors), "b");
  assert.equal(resolveActiveFloorId({ activeFloorId: "zzz" }, floors), "a");
  assert.equal(resolveActiveFloorId({}, floors), "a");

  const source = {
    plan: { name: "Base", activeFloorId: "b" },
    floors: [
      { id: "a", name: "A" },
      { id: "b", name: "B" }
    ],
    zones: [
      { id: "z", floorId: "b" },
      { id: "z2", floorId: "desconhecido" }
    ],
    objects: [{ id: "o", floorId: "a" }],
    connectionPoints: [
      { id: "p1", floorId: "a", linkedObjectId: "o" },
      { id: "p2", floorId: "a", linkedObjectId: "fora" }
    ],
    cableRoutes: [
      { id: "r", floorId: "a", sourcePointId: "p1", targetPointId: "p2" },
      { id: "r2", floorId: "a", sourcePointId: "x", targetPointId: null }
    ]
  };
  const copy = planFloorPlanDuplicate(source, "novo");
  assert.equal(copy.name, "Base - copia");
  const floorIds = copy.floors.map((floor) => floor.id);
  assert.equal(new Set(floorIds).size, 2);
  assert.ok(!floorIds.includes("a") && !floorIds.includes("b"));
  assert.equal(copy.activeFloorId, floorIds[1], "andar ativo acompanha o remapeamento");
  assert.equal(copy.zones[0].floorId, floorIds[1]);
  assert.equal(copy.zones[1].floorId, copy.activeFloorId, "andar desconhecido cai no ativo");
  assert.ok(copy.zones.every((zone) => zone.planId === "novo" && !["z", "z2"].includes(zone.id)));
  assert.equal(copy.objects[0].floorId, floorIds[0]);
  assert.equal(copy.connectionPoints[0].linkedObjectId, copy.objects[0].id);
  assert.equal(copy.connectionPoints[1].linkedObjectId, null);
  assert.equal(copy.cableRoutes[0].sourcePointId, copy.connectionPoints[0].id);
  assert.equal(copy.cableRoutes[0].targetPointId, copy.connectionPoints[1].id);
  assert.equal(copy.cableRoutes[1].sourcePointId, null);
  assert.equal(source.floors[0].id, "a", "origem nao e alterada");
});

test("fundo da planta: assinatura real, tamanho e nome normalizado", () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const ok = validateFloorPlanBackground(png, "IMAGE/PNG; charset=x", "Planta Térreo (1).PNG");
  assert.deepEqual(ok, { mimeType: "image/png", fileName: "Planta-Terreo-1-.png" });
  assert.throws(
    () => validateFloorPlanBackground(Buffer.alloc(0), "image/png"),
    (error) => error.statusCode === 400
  );
  assert.throws(
    () => validateFloorPlanBackground(Buffer.alloc(8 * 1024 * 1024 + 1), "image/png"),
    (error) => error.statusCode === 413
  );
  assert.throws(
    () => validateFloorPlanBackground(Buffer.from("<html>"), "image/png"),
    (error) => error.statusCode === 400
  );
  assert.equal(floorPlanBackgroundUrl("p", "f"), "/api/floor-plans/p/floors/f/background");
});

test("infraestrutura: severidade, snapshot e metrica valida", () => {
  assert.equal(assetHeatmapSeverity("availability", 0, "online"), "low");
  assert.equal(assetHeatmapSeverity("availability", 0, "offline"), "critical");
  assert.equal(assetHeatmapSeverity("availability", 0, "no_agent"), "medium");
  assert.equal(assetHeatmapSeverity("alerts", 3, "online"), "high");
  assert.equal(assetHeatmapSeverity("cpu", 90, "online"), "critical");
  assert.equal(assetHeatmapSeverity("cpu", 10, "online"), "low");
  assert.equal(assetSnapshot(null).status, "no_agent");
  const fresh = assetSnapshot({
    memory_total_bytes: 100,
    memory_used_bytes: 50,
    disk_total_bytes: 200,
    disk_free_bytes: 50,
    last_seen_at: new Date().toISOString(),
    cpu_usage_percent: "12",
    hostname: "H"
  });
  assert.equal(fresh.status, "online");
  assert.equal(fresh.ram, 50);
  assert.equal(fresh.disk, 75);
  assert.equal(fresh.cpu, 12);
  assert.equal(fresh.name, "H");
  assert.equal(assetSnapshot({ last_seen_at: "2020-01-01T00:00:00Z" }).status, "offline");
  assert.doesNotThrow(() => assertAssetHeatmapMetric("cpu"));
  assert.throws(
    () => assertAssetHeatmapMetric("inventada"),
    (error) => error.statusCode === 400
  );
});

test("mapas de calor e resumo agregam ativos, alertas e OS por componente", () => {
  const now = Date.now();
  const data = {
    objects: [
      { id: "c1", label: "Srv", linked_asset_id: "a1", group_id: "g1", segment_id: "s1" },
      { id: "c2", label: "PC", linked_asset_id: "a2", group_id: null, segment_id: null },
      { id: "c3", label: "Mesa", linked_asset_id: null }
    ],
    assets: [{ asset_id: "a1", hostname: "srv", last_seen_at: new Date(now).toISOString(), cpu_usage_percent: 80 }],
    alerts: [
      { asset_id: "a1", severity: "critical" },
      { asset_id: "a1", severity: "low" }
    ],
    orders: [
      { asset_id: "a1", created_at: new Date(now - 3600e3).toISOString(), closed_at: null, sla_due_at: new Date(now - 1000).toISOString() },
      { asset_id: "a1", created_at: new Date(now - 7200e3).toISOString(), closed_at: new Date(now).toISOString(), sla_due_at: null },
      { asset_id: "a2", created_at: new Date(now - 400 * 86400e3).toISOString(), closed_at: null, sla_due_at: null }
    ]
  };

  const heat = buildAssetHeatmap(data, "alerts");
  assert.equal(heat.components.length, 2);
  assert.equal(heat.components[0].alerts, 2);
  assert.equal(heat.components[0].serviceOrders, 2);
  assert.equal(heat.components[0].severity, "medium");
  assert.equal(heat.components[1].status, "no_agent");
  assert.deepEqual(heat.filters, { groupId: null, segmentId: null });
  assert.equal(buildAssetHeatmap(data, "cpu", { groupId: "g1" }).components.length, 1);
  assert.equal(buildAssetHeatmap(data, "availability").components[1].score, 50);

  const { start, end } = parseHeatmapPeriod(new Date(now - 86400e3).toISOString(), new Date(now + 86400e3).toISOString());
  const orders = buildServiceOrderHeatmap(data, start, end, {});
  assert.equal(orders.components[0].totalServiceOrders, 2);
  assert.equal(orders.components[0].openServiceOrders, 1);
  assert.equal(orders.components[0].overdueServiceOrders, 1);
  assert.equal(orders.components[0].score, 2 + 2 + 3);
  assert.equal(orders.components[0].severity, "high");
  assert.equal(orders.summary.totalServiceOrders, 2);
  assert.throws(
    () => parseHeatmapPeriod("x", "y"),
    (error) => error.statusCode === 400
  );
  assert.throws(
    () => parseHeatmapPeriod(end.toISOString(), start.toISOString()),
    (error) => error.statusCode === 400
  );
  assert.throws(
    () => parseHeatmapPeriod("2020-01-01", "2022-01-01"),
    (error) => error.statusCode === 400
  );

  const summary = buildInfrastructureSummary(data);
  assert.equal(summary.totalComponents, 3);
  assert.equal(summary.linkedAssets, 2);
  assert.equal(summary.onlineAssets, 1);
  assert.equal(summary.assetsWithoutAgent, 1);
  assert.equal(summary.openServiceOrders, 2);
  assert.equal(summary.overdueServiceOrders, 1);
  assert.equal(summary.criticalAlerts, 1);
  assert.equal(summary.segmentsRepresented, 1);
  assert.equal(summary.groupsRepresented, 1);
});
