import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

// Caracteriza o mapa visual de inventario (mapas, objetos e conexoes) pela API
// antes da divisao do antigo repositories/inventoryVisualMapRepository.js.

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "inventory-visual-map-secret-with-32-characters";
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

test("mapa visual: mapas, objetos (com ativo), conexoes e regras de validacao", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const manual = await api(baseUrl, cookie, "POST", "/devices/manual", {
    name: "PC do mapa visual",
    type: "desktop",
    brand: "X",
    model: "Y",
    assetTag: "VM-CHAR-1",
    ip: "203.0.113.55"
  });
  assert.equal(manual.status, 201, JSON.stringify(manual.body));
  const assetId = manual.body.device.id;

  // mapas
  assert.equal((await api(baseUrl, cookie, "POST", "/inventory-visual-maps", { name: "x" })).status, 400);
  const created = await api(baseUrl, cookie, "POST", "/inventory-visual-maps", {
    name: "  Sala 1  ",
    width: 1,
    depth: 999,
    scale: "2",
    floorLabel: "Andar 2",
    notes: ""
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const map = created.body.map;
  assert.equal(map.name, "Sala 1");
  assert.equal(map.width, 5);
  assert.equal(map.depth, 200);
  assert.equal(map.scale, 2);
  assert.equal(map.floorLabel, "Andar 2");
  assert.equal(map.notes, null);
  assert.equal(map.objectCount, 0);

  const patched = await api(baseUrl, cookie, "PATCH", `/inventory-visual-maps/${map.id}`, { name: "Sala 1B", width: 40 });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.map.name, "Sala 1B");
  assert.equal(patched.body.map.width, 40);
  assert.equal(patched.body.map.depth, 200, "campos nao enviados sao preservados");
  assert.equal((await api(baseUrl, cookie, "GET", "/inventory-visual-maps/nao-existe")).status, 404);

  // objetos
  const badPreset = await api(baseUrl, cookie, "POST", `/inventory-visual-maps/${map.id}/objects`, { presetType: "ovni" });
  assert.equal(badPreset.status, 400);
  const withMissingAsset = await api(baseUrl, cookie, "POST", `/inventory-visual-maps/${map.id}/objects`, {
    presetType: "desktop",
    linkedAssetId: "ativo-inexistente"
  });
  assert.equal(withMissingAsset.status, 400);
  assert.match(withMissingAsset.body.message, /Ativo informado nao foi encontrado/);

  const object = await api(baseUrl, cookie, "POST", `/inventory-visual-maps/${map.id}/objects`, {
    presetType: "desktop",
    label: "PC 1",
    linkedAssetId: assetId,
    x: 1000,
    y: 1,
    z: -3,
    color: "azul",
    metadata: { a: 1 }
  });
  assert.equal(object.status, 201, JSON.stringify(object.body));
  const first = object.body.object;
  assert.equal(first.layer, "assets");
  assert.equal(first.label, "PC 1");
  assert.equal(first.positionX, 200, "posicao limitada ao intervalo");
  assert.equal(first.positionZ, -3);
  assert.match(first.color, /^#[0-9a-f]{6}$/i, "cor invalida volta para a padrao do preset");
  assert.deepEqual(first.metadata, { a: 1 });

  const duplicateAsset = await api(baseUrl, cookie, "POST", `/inventory-visual-maps/${map.id}/objects`, {
    presetType: "desktop",
    linkedAssetId: assetId
  });
  assert.equal(duplicateAsset.status, 409);
  assert.match(duplicateAsset.body.message, /ja esta posicionado/);

  const second = await api(baseUrl, cookie, "POST", `/inventory-visual-maps/${map.id}/objects`, { presetType: "switch" });
  assert.equal(second.status, 201, JSON.stringify(second.body));
  assert.equal(second.body.object.layer, "infrastructure");
  const wall = await api(baseUrl, cookie, "POST", `/inventory-visual-maps/${map.id}/objects`, { presetType: "wall", label: "Parede" });
  assert.equal(wall.status, 201, JSON.stringify(wall.body));
  assert.equal(wall.body.object.layer, "structure");

  const listedMaps = await api(baseUrl, cookie, "GET", "/inventory-visual-maps");
  assert.equal(listedMaps.body.maps.find((item) => item.id === map.id).objectCount, 3);

  const moved = await api(baseUrl, cookie, "PATCH", `/inventory-visual-map-objects/${first.id}`, { label: "PC 1 movido", positionX: 5 });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.object.label, "PC 1 movido");
  assert.equal(moved.body.object.positionX, 5);
  assert.equal(moved.body.object.linkedAssetId, assetId, "vinculo preservado");
  const unlink = await api(baseUrl, cookie, "PATCH", `/inventory-visual-map-objects/${first.id}`, { linkedAssetId: null });
  assert.equal(unlink.status, 200);
  assert.equal(unlink.body.object.linkedAssetId, assetId, "null nao desvincula (valor atual prevalece)");
  assert.equal((await api(baseUrl, cookie, "PATCH", "/inventory-visual-map-objects/nao-existe", { label: "x" })).status, 404);

  // conexoes
  const noPoints = await api(baseUrl, cookie, "POST", `/inventory-visual-maps/${map.id}/connections`, {
    layer: "infrastructure",
    points: [[0, 0, 0]]
  });
  assert.equal(noPoints.status, 400);
  const badType = await api(baseUrl, cookie, "POST", `/inventory-visual-maps/${map.id}/connections`, {
    layer: "electrical",
    connectionType: "uplink",
    points: [
      [0, 0, 0],
      [1, 0, 1]
    ]
  });
  assert.equal(badType.status, 400);
  const otherMap = await api(baseUrl, cookie, "POST", "/inventory-visual-maps", { name: "Outro mapa" });
  const foreign = await api(baseUrl, cookie, "POST", `/inventory-visual-maps/${otherMap.body.map.id}/connections`, {
    layer: "infrastructure",
    sourceObjectId: first.id,
    points: [
      [0, 0, 0],
      [1, 0, 1]
    ]
  });
  assert.equal(foreign.status, 400);
  assert.match(foreign.body.message, /pertence a outro mapa/);

  const connection = await api(baseUrl, cookie, "POST", `/inventory-visual-maps/${map.id}/connections`, {
    layer: "infrastructure",
    sourceObjectId: first.id,
    targetObjectId: second.body.object.id,
    sourceAssetId: assetId,
    points: [[0, 0, 0], { x: 500, y: 0, z: 1 }],
    thickness: 99,
    dashed: true,
    color: "nope"
  });
  assert.equal(connection.status, 201, JSON.stringify(connection.body));
  const link = connection.body.connection;
  assert.equal(link.connectionType, "network_cable");
  assert.equal(link.thickness, 12);
  assert.equal(link.dashed, true);
  assert.equal(link.points.length, 2);
  assert.equal(link.points[1].x, 200);
  assert.equal(link.points[1].y, 0);
  assert.match(link.color, /^#[0-9a-f]{6}$/i);

  const updatedLink = await api(baseUrl, cookie, "PATCH", `/inventory-visual-map-connections/${link.id}`, {
    label: "Backbone",
    dashed: false
  });
  assert.equal(updatedLink.status, 200);
  assert.equal(updatedLink.body.connection.label, "Backbone");
  assert.equal(updatedLink.body.connection.dashed, false);
  assert.equal(updatedLink.body.connection.sourceAssetId, assetId);

  const contents = await api(baseUrl, cookie, "GET", `/inventory-visual-maps/${map.id}`);
  assert.equal(contents.body.objects.length, 3);
  assert.equal(contents.body.connections.length, 1);
  assert.deepEqual(
    contents.body.objects.map((item) => item.layer),
    [...contents.body.objects.map((item) => item.layer)].sort()
  );
  assert.equal((await api(baseUrl, cookie, "GET", `/inventory-visual-maps/${map.id}/objects`)).body.objects.length, 3);
  assert.equal((await api(baseUrl, cookie, "GET", `/inventory-visual-maps/${map.id}/connections`)).body.connections.length, 1);

  // remocoes
  assert.equal((await api(baseUrl, cookie, "DELETE", `/inventory-visual-map-connections/${link.id}`)).status, 200);
  assert.equal((await api(baseUrl, cookie, "DELETE", `/inventory-visual-map-connections/${link.id}`)).status, 404);
  const removedObject = await api(baseUrl, cookie, "DELETE", `/inventory-visual-map-objects/${first.id}`);
  assert.equal(removedObject.status, 200);
  assert.equal(removedObject.body.object.id, first.id);
  const removedMap = await api(baseUrl, cookie, "DELETE", `/inventory-visual-maps/${map.id}`);
  assert.equal(removedMap.status, 200);
  assert.equal((await api(baseUrl, cookie, "GET", `/inventory-visual-maps/${map.id}/objects`)).status, 404);

  const logTypes = (await listLogs()).map((log) => log.type);
  for (const expected of [
    "inventory.visual_map.created",
    "inventory.visual_map.updated",
    "inventory.visual_map.deleted",
    "inventory.visual_map.object.created",
    "inventory.visual_map.object.updated",
    "inventory.visual_map.object.deleted",
    "inventory.visual_map.connection.created",
    "inventory.visual_map.connection.updated",
    "inventory.visual_map.connection.deleted"
  ]) {
    assert.ok(logTypes.includes(expected), `log ${expected} ausente`);
  }
  const history = await listAssetHistory(assetId);
  const messages = history
    .filter((event) => event.eventType === "inventory_visual_map")
    .map((event) => event.message)
    .sort();
  assert.deepEqual(
    messages,
    [
      "Ativo posicionado no mapa visual Sala 1B.",
      "Ativo removido do mapa visual Sala 1B.",
      "Posicao do ativo atualizada no mapa visual Sala 1B.",
      "Posicao do ativo atualizada no mapa visual Sala 1B."
    ].sort()
  );
});
