import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "integration-test-secret-with-at-least-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("mapa de infraestrutura protege upload e calcula resumo e calor com dados persistidos", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@itguardian.local", password: "123456" })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie");
  const jsonHeaders = { "content-type": "application/json", cookie, origin: "http://localhost:5173" };

  const created = await fetch(`${baseUrl}/api/floor-plans`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ name: "Mapa físico de teste", company: "IT Guardian", floorLabel: "Térreo" })
  });
  assert.equal(created.status, 201);
  const bundle = (await created.json()).plan;
  const planId = bundle.plan.id;
  const floorId = bundle.floors[0].id;

  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const uploaded = await fetch(`${baseUrl}/api/floor-plans/${planId}/floors/${floorId}/background`, {
    method: "POST",
    headers: { cookie, origin: "http://localhost:5173", "content-type": "image/png", "x-file-name": encodeURIComponent("Planta térreo.png") },
    body: png
  });
  assert.equal(uploaded.status, 201);
  assert.equal((await uploaded.json()).background.mimeType, "image/png");

  const unauthenticated = await fetch(`${baseUrl}/api/floor-plans/${planId}/floors/${floorId}/background`);
  assert.equal(unauthenticated.status, 401);

  const downloaded = await fetch(`${baseUrl}/api/floor-plans/${planId}/floors/${floorId}/background`, { headers: { cookie } });
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get("content-type"), "image/png");
  const downloadedBytes = Buffer.from(await downloaded.arrayBuffer());
  assert.ok(downloadedBytes.length >= png.length);
  assert.ok(downloadedBytes.includes(Buffer.from("PNG")));

  const forged = await fetch(`${baseUrl}/api/floor-plans/${planId}/floors/${floorId}/background`, {
    method: "POST",
    headers: { cookie, origin: "http://localhost:5173", "content-type": "image/png", "x-file-name": "ataque.png" },
    body: Buffer.from("<html>não é imagem</html>")
  });
  assert.equal(forged.status, 400);

  const objectId = "component-test-1";
  const saved = await fetch(`${baseUrl}/api/floor-plans/${planId}/editor-data`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify({
      floors: bundle.floors,
      zones: [],
      objects: [{
        id: objectId,
        floorId,
        objectType: "server",
        category: "asset",
        label: "Servidor financeiro",
        linkedAssetId: "asset-sem-agente",
        x: 100,
        y: 120,
        width: 80,
        height: 56,
        metadata: { criticality: "critical", description: "Servidor central" }
      }],
      connectionPoints: [],
      cableRoutes: []
    })
  });
  assert.equal(saved.status, 200);

  const summaryResponse = await fetch(`${baseUrl}/api/floor-plans/${planId}/summary`, { headers: { cookie } });
  assert.equal(summaryResponse.status, 200);
  const summary = (await summaryResponse.json()).summary;
  assert.equal(summary.totalComponents, 1);
  assert.equal(summary.linkedAssets, 1);
  assert.equal(summary.assetsWithoutAgent, 1);

  const assetHeatmapResponse = await fetch(`${baseUrl}/api/floor-plans/${planId}/heatmap/assets?metric=availability`, { headers: { cookie } });
  assert.equal(assetHeatmapResponse.status, 200);
  const assetHeatmap = (await assetHeatmapResponse.json()).heatmap;
  assert.equal(assetHeatmap.components[0].componentId, objectId);
  assert.equal(assetHeatmap.components[0].status, "no_agent");

  const invalidMetric = await fetch(`${baseUrl}/api/floor-plans/${planId}/heatmap/assets?metric=inventada`, { headers: { cookie } });
  assert.equal(invalidMetric.status, 400);

  const startDate = new Date(Date.now() - 86_400_000).toISOString();
  const endDate = new Date(Date.now() + 86_400_000).toISOString();
  const osHeatmapResponse = await fetch(`${baseUrl}/api/floor-plans/${planId}/heatmap/service-orders?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`, { headers: { cookie } });
  assert.equal(osHeatmapResponse.status, 200);
  assert.equal((await osHeatmapResponse.json()).heatmap.components[0].totalServiceOrders, 0);

  const removed = await fetch(`${baseUrl}/api/floor-plans/${planId}/floors/${floorId}/background`, {
    method: "DELETE",
    headers: jsonHeaders
  });
  assert.equal(removed.status, 200);
  assert.equal((await fetch(`${baseUrl}/api/floor-plans/${planId}/floors/${floorId}/background`, { headers: { cookie } })).status, 404);
});
