import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "integration-test-secret-with-at-least-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { createUser } = await import("../src/repositories/userRepository.js");
const { default: jwt } = await import("jsonwebtoken");

const trustedOrigin = "http://localhost:5173";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function login(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@itguardian.local", password: "123456" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

function requestHeaders(cookie) {
  return {
    "content-type": "application/json",
    cookie,
    origin: trustedOrigin
  };
}

async function createManualAsset(baseUrl, cookie, name) {
  const response = await fetch(`${baseUrl}/api/devices/manual`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({
      name,
      type: "server",
      brand: "Generica",
      model: "Teste",
      assetTag: `TOPO-${name}`,
      ip: "203.0.113.61"
    })
  });
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  return body.device;
}

test("mapa de rede: ciclo completo (mapa, nos, posicoes, conexoes, auto-layout)", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const assetA = await createManualAsset(baseUrl, cookie, "SwitchTopoA");
  const assetB = await createManualAsset(baseUrl, cookie, "DesktopTopoB");
  const assetC = await createManualAsset(baseUrl, cookie, "DesktopTopoC");

  const createMapResponse = await fetch(`${baseUrl}/api/topology-maps`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ name: "Mapa de teste integrado" })
  });
  const createMapBody = await createMapResponse.json();
  assert.equal(createMapResponse.status, 201, JSON.stringify(createMapBody));
  const map = createMapBody.map;
  assert.equal(map.scopeType, "global");

  const listMapsResponse = await fetch(`${baseUrl}/api/topology-maps`, { headers: { cookie } });
  assert.equal(listMapsResponse.status, 200);
  const listedMaps = (await listMapsResponse.json()).maps;
  assert.ok(listedMaps.some((entry) => entry.id === map.id));

  const createNodeAResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}/nodes`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ assetId: assetA.id, x: 10, y: 10 })
  });
  const nodeABody = await createNodeAResponse.json();
  assert.equal(createNodeAResponse.status, 201, JSON.stringify(nodeABody));
  const nodeA = nodeABody.node;

  const createNodeBResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}/nodes`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ assetId: assetB.id, x: 20, y: 20 })
  });
  assert.equal(createNodeBResponse.status, 201);
  const nodeB = (await createNodeBResponse.json()).node;

  const duplicateNodeResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}/nodes`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ assetId: assetA.id, x: 99, y: 99 })
  });
  assert.equal(duplicateNodeResponse.status, 409, "mesmo ativo nao pode virar dois nos no mesmo mapa");

  const bulkPositionsResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}/nodes/positions`, {
    method: "PATCH",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ positions: [{ nodeId: nodeA.id, x: 111, y: 222 }] })
  });
  const bulkPositionsBody = await bulkPositionsResponse.json();
  assert.equal(bulkPositionsResponse.status, 200, JSON.stringify(bulkPositionsBody));
  assert.equal(bulkPositionsBody.nodes[0].x, 111);
  assert.equal(bulkPositionsBody.nodes[0].y, 222);

  const createLinkResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}/links`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ sourceAssetId: assetA.id, targetAssetId: assetB.id, type: "ethernet" })
  });
  const linkBody = await createLinkResponse.json();
  assert.equal(createLinkResponse.status, 201, JSON.stringify(linkBody));
  const link = linkBody.link;

  const duplicateLinkResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}/links`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ sourceAssetId: assetB.id, targetAssetId: assetA.id })
  });
  assert.equal(duplicateLinkResponse.status, 409, "mesma conexao na ordem invertida deve ser recusada");

  const selfLinkResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}/links`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ sourceAssetId: assetA.id, targetAssetId: assetA.id })
  });
  assert.equal(selfLinkResponse.status, 400, "ativo nao pode se conectar com ele mesmo");

  const updateLinkResponse = await fetch(`${baseUrl}/api/topology-map-links/${link.id}`, {
    method: "PATCH",
    headers: requestHeaders(cookie),
    body: JSON.stringify({
      sourceAssetId: assetA.id,
      targetAssetId: assetB.id,
      label: "Uplink principal",
      type: "fiber"
    })
  });
  const updateLinkBody = await updateLinkResponse.json();
  assert.equal(updateLinkResponse.status, 200, JSON.stringify(updateLinkBody));
  assert.equal(updateLinkBody.link.label, "Uplink principal");

  const getMapBundleResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}`, { headers: { cookie } });
  const bundle = await getMapBundleResponse.json();
  assert.equal(getMapBundleResponse.status, 200);
  assert.equal(bundle.nodes.length, 2);
  assert.equal(bundle.links.length, 1);

  const nodeCResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}/nodes`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ assetId: assetC.id, x: 0, y: 0 })
  });
  assert.equal(nodeCResponse.status, 201);
  const nodeC = (await nodeCResponse.json()).node;

  const autoLayoutResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}/auto-layout`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ hints: [{ assetId: assetA.id, assetType: "server" }] })
  });
  const autoLayoutBody = await autoLayoutResponse.json();
  assert.equal(autoLayoutResponse.status, 200, JSON.stringify(autoLayoutBody));
  assert.equal(autoLayoutBody.nodes.length, 3);

  const deleteLinkResponse = await fetch(`${baseUrl}/api/topology-map-links/${link.id}`, {
    method: "DELETE",
    headers: requestHeaders(cookie)
  });
  assert.equal(deleteLinkResponse.status, 200);

  const deleteNodeCResponse = await fetch(`${baseUrl}/api/topology-map-nodes/${nodeC.id}`, {
    method: "DELETE",
    headers: requestHeaders(cookie)
  });
  assert.equal(deleteNodeCResponse.status, 200);

  const deleteMapResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}`, {
    method: "DELETE",
    headers: requestHeaders(cookie)
  });
  assert.equal(deleteMapResponse.status, 200);

  const getDeletedMapResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}`, { headers: { cookie } });
  assert.equal(getDeletedMapResponse.status, 404, "mapa removido nao deve mais existir");

  void nodeB;
});

test("mapa de rede: acesso sem sessao e recusado", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const response = await fetch(`${baseUrl}/api/topology-maps`);
  assert.equal(response.status, 401);
});

test("mapa de rede: usuario sem permissao de gerenciar nao consegue criar mapa", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const viewerUser = await createUser({
    name: "Visualizador Topologia",
    email: "viewer-topo@itguardian.test",
    password: "not-used-in-this-test",
    role: "viewer"
  });
  const viewerToken = jwt.sign({ sub: viewerUser.id }, process.env.JWT_SECRET, { expiresIn: "1h" });

  const response = await fetch(`${baseUrl}/api/topology-maps`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${viewerToken}`,
      origin: trustedOrigin
    },
    body: JSON.stringify({ name: "Mapa negado" })
  });
  assert.equal(response.status, 403);
});
