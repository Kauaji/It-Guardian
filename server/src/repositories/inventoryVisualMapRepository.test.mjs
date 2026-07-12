import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeConnectionPayload,
  normalizeMapPayload,
  normalizeObjectPayload,
  resolveConnectionTypeLayer,
  resolveObjectLayer
} from "./inventoryVisualMapRepository.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function source(relativePath) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

test("normaliza payload do mapa visual com limites seguros", () => {
  const payload = normalizeMapPayload({
    name: "  Mapa TI  ",
    width: "300",
    depth: "2",
    scale: "0.001"
  });

  assert.equal(payload.name, "Mapa TI");
  assert.equal(payload.width, 200);
  assert.equal(payload.depth, 5);
  assert.equal(payload.scale, 0.1);
});

test("rejeita mapa visual sem nome", () => {
  assert.throws(() => normalizeMapPayload({ name: " " }), /nome/i);
});

test("normaliza objetos com limites seguros e cor padrao", () => {
  const object = normalizeObjectPayload({
    presetType: "server",
    color: "invalid",
    positionX: "999",
    linkedAssetId: " asset-1 "
  });

  assert.equal(object.presetType, "server");
  assert.equal(object.positionX, 200);
  assert.equal(object.linkedAssetId, "asset-1");
  assert.equal(object.color, "#0f766e");
});

test("resolve camada padrao de objetos estruturais e ativos", () => {
  assert.equal(resolveObjectLayer("desk"), "structure");
  assert.equal(resolveObjectLayer("server"), "assets");
  assert.equal(resolveObjectLayer("desk", "assets"), "assets");
  assert.equal(resolveObjectLayer("patch_panel"), "infrastructure");
  assert.equal(resolveObjectLayer("electrical_panel"), "electrical");
});

test("normaliza conexoes tecnicas com pontos manuais", () => {
  const connection = normalizeConnectionPayload({
    layer: "infrastructure",
    connectionType: "network_cable",
    label: " Cabo rack ",
    points: [
      { x: "-999", y: 0.2, z: 1 },
      [4, 0.2, "999"]
    ],
    thickness: "20",
    dashed: true,
    color: "invalid",
    metadata: { port: "A1" }
  });

  assert.equal(connection.layer, "infrastructure");
  assert.equal(connection.connectionType, "network_cable");
  assert.equal(connection.label, "Cabo rack");
  assert.equal(connection.points[0].x, -200);
  assert.equal(connection.points[1].z, 200);
  assert.equal(connection.thickness, 12);
  assert.equal(connection.dashed, true);
  assert.equal(connection.color, "#0ea5e9");
  assert.deepEqual(connection.metadata, { port: "A1" });
});

test("rejeita conexoes com camada, tipo ou pontos invalidos", () => {
  assert.throws(() => normalizeConnectionPayload({ layer: "assets", points: [{}, {}] }), /camada/i);
  assert.throws(
    () => normalizeConnectionPayload({ layer: "electrical", connectionType: "network_cable", points: [{}, {}] }),
    /tipo/i
  );
  assert.throws(() => normalizeConnectionPayload({ layer: "electrical", connectionType: "power_line", points: [{}] }), /dois pontos/i);
});

test("resolve camada pelo tipo de conexao tecnica", () => {
  assert.equal(resolveConnectionTypeLayer("uplink"), "infrastructure");
  assert.equal(resolveConnectionTypeLayer("ups_line"), "electrical");
  assert.equal(resolveConnectionTypeLayer("unknown"), null);
});

test("schema e rotas do mapa visual estao registrados", () => {
  const schema = source("../schema/legacyBootstrap.js");
  const app = source("../app.js");
  const routes = source("../routes/inventoryVisualMapRoutes.js");

  assert.match(schema, /CREATE TABLE IF NOT EXISTS inventory_visual_maps/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS inventory_visual_map_objects/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS inventory_visual_map_connections/);
  assert.match(schema, /idx_inventory_visual_map_connections_map/);
  assert.match(schema, /layer IN \('structure', 'assets', 'infrastructure', 'electrical'\)/);
  assert.match(app, /\/api\/inventory-visual-maps/);
  assert.match(app, /\/api\/inventory-visual-map-objects/);
  assert.match(app, /\/api\/inventory-visual-map-connections/);
  assert.match(routes, /\/:id\/connections/);
  assert.match(routes, /inventoryVisualMapConnectionRoutes/);
  assert.match(routes, /requirePermission\("inventory\.view"\)/);
  assert.match(routes, /requirePermission\("inventory\.manage_segments"\)/);
});

test("listagem de mapas evita recursos SQL nao suportados pelo pg-mem", () => {
  const repository = source("inventoryVisualMapRepository.js");

  assert.doesNotMatch(repository, /GROUP BY maps\.id/);
  assert.doesNotMatch(repository, /\bROW_NUMBER\s*\(/);
  assert.match(repository, /COUNT\(\*\) AS object_count/);
  assert.match(repository, /GROUP BY map_id/);
});
