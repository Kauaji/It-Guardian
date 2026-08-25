import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "integration-test-secret-with-at-least-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");

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

async function createSegment(baseUrl, cookie, name) {
  const response = await fetch(`${baseUrl}/api/segments`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ name, color: "#1f7a61" })
  });
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  return body.segment;
}

async function createGroup(baseUrl, cookie, name) {
  const response = await fetch(`${baseUrl}/api/segments/groups`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ name, color: "#1f7a61" })
  });
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  return body.group;
}

async function getOrCreateTabScopedMap(baseUrl, cookie, tabId, tabName) {
  const response = await fetch(
    `${baseUrl}/api/topology-maps/by-scope?scopeType=inventory_tab&scopeId=${tabId}&scopeName=${encodeURIComponent(tabName)}`,
    { headers: { cookie } }
  );
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.map;
}

test("mapa de rede: cria no de cluster (grupo) num mapa de aba", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const group = await createGroup(baseUrl, cookie, `Grupo Cluster ${Date.now()}`);
  const map = await getOrCreateTabScopedMap(baseUrl, cookie, `tab-cluster-${Date.now()}`, "Aba de teste");

  const response = await fetch(`${baseUrl}/api/topology-maps/${map.id}/nodes`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ nodeType: "group", refId: group.id, x: 20, y: 30 })
  });
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.node.nodeType, "group");
  assert.equal(body.node.refId, group.id);
  assert.equal(body.node.assetId, null);
});

test("mapa de rede: no de cluster duplicado (mesmo tipo e ref) devolve 409", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const segment = await createSegment(baseUrl, cookie, `Segmento Cluster Dup ${Date.now()}`);
  const map = await getOrCreateTabScopedMap(baseUrl, cookie, `tab-cluster-dup-${Date.now()}`, "Aba de teste");

  const firstResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}/nodes`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ nodeType: "segment", refId: segment.id, x: 0, y: 0 })
  });
  assert.equal(firstResponse.status, 201);

  const duplicateResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}/nodes`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ nodeType: "segment", refId: segment.id, x: 40, y: 40 })
  });
  assert.equal(duplicateResponse.status, 409);
});

test("mapa de rede: no de cluster com segmento inexistente devolve 404", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const map = await getOrCreateTabScopedMap(baseUrl, cookie, `tab-cluster-404-${Date.now()}`, "Aba de teste");

  const response = await fetch(`${baseUrl}/api/topology-maps/${map.id}/nodes`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ nodeType: "segment", refId: "segmento-que-nao-existe", x: 0, y: 0 })
  });
  const body = await response.json();
  assert.equal(response.status, 404, JSON.stringify(body));
});

test("mapa de rede: liga dois segmentos (cluster-a-cluster) com sucesso", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const segmentA = await createSegment(baseUrl, cookie, `Segmento Link A ${Date.now()}`);
  const segmentB = await createSegment(baseUrl, cookie, `Segmento Link B ${Date.now()}`);
  const map = await getOrCreateTabScopedMap(baseUrl, cookie, `tab-cluster-link-${Date.now()}`, "Aba de teste");

  const response = await fetch(`${baseUrl}/api/topology-maps/${map.id}/links`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({
      sourceType: "segment",
      targetType: "segment",
      sourceAssetId: segmentA.id,
      targetAssetId: segmentB.id
    })
  });
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.link.sourceType, "segment");
  assert.equal(body.link.targetType, "segment");
});

test("mapa de rede: conexao entre tipos diferentes (segmento com grupo) devolve 400", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const segment = await createSegment(baseUrl, cookie, `Segmento Misto ${Date.now()}`);
  const group = await createGroup(baseUrl, cookie, `Grupo Misto ${Date.now()}`);
  const map = await getOrCreateTabScopedMap(baseUrl, cookie, `tab-cluster-misto-${Date.now()}`, "Aba de teste");

  const response = await fetch(`${baseUrl}/api/topology-maps/${map.id}/links`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({
      sourceType: "segment",
      targetType: "group",
      sourceAssetId: segment.id,
      targetAssetId: group.id
    })
  });
  assert.equal(response.status, 400);
});

test("mapa de rede: conexao cluster duplicada (ordem invertida) devolve 409", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const groupA = await createGroup(baseUrl, cookie, `Grupo Dup A ${Date.now()}`);
  const groupB = await createGroup(baseUrl, cookie, `Grupo Dup B ${Date.now()}`);
  const map = await getOrCreateTabScopedMap(baseUrl, cookie, `tab-cluster-linkdup-${Date.now()}`, "Aba de teste");

  const firstResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}/links`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({
      sourceType: "group",
      targetType: "group",
      sourceAssetId: groupA.id,
      targetAssetId: groupB.id
    })
  });
  assert.equal(firstResponse.status, 201);

  const invertedResponse = await fetch(`${baseUrl}/api/topology-maps/${map.id}/links`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({
      sourceType: "group",
      targetType: "group",
      sourceAssetId: groupB.id,
      targetAssetId: groupA.id
    })
  });
  assert.equal(invertedResponse.status, 409);
});
