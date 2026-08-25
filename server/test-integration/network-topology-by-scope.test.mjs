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

test("mapa de rede por escopo: mapa de segmento e criado sob demanda e reaproveitado", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const segment = await createSegment(baseUrl, cookie, `Segmento By-Scope ${Date.now()}`);

  const firstResponse = await fetch(
    `${baseUrl}/api/topology-maps/by-scope?scopeType=segment&scopeId=${segment.id}`,
    { headers: { cookie } }
  );
  const firstBody = await firstResponse.json();
  assert.equal(firstResponse.status, 200, JSON.stringify(firstBody));
  assert.equal(firstBody.map.scopeType, "segment");
  assert.equal(firstBody.map.scopeId, segment.id);
  assert.equal(firstBody.map.name, segment.name, "mapa criado automaticamente usa o nome real do segmento");
  assert.deepEqual(firstBody.nodes, []);
  assert.deepEqual(firstBody.links, []);

  const secondResponse = await fetch(
    `${baseUrl}/api/topology-maps/by-scope?scopeType=segment&scopeId=${segment.id}`,
    { headers: { cookie } }
  );
  const secondBody = await secondResponse.json();
  assert.equal(secondResponse.status, 200);
  assert.equal(secondBody.map.id, firstBody.map.id, "segunda chamada reaproveita o mesmo mapa (get-or-create)");
});

test("mapa de rede por escopo: funciona tambem para grupo", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const group = await createGroup(baseUrl, cookie, `Grupo By-Scope ${Date.now()}`);

  const response = await fetch(
    `${baseUrl}/api/topology-maps/by-scope?scopeType=group&scopeId=${group.id}`,
    { headers: { cookie } }
  );
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.map.scopeType, "group");
  assert.equal(body.map.scopeId, group.id);
  assert.equal(body.map.name, group.name);
});

test("mapa de rede por escopo: segmento inexistente devolve 404", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const response = await fetch(
    `${baseUrl}/api/topology-maps/by-scope?scopeType=segment&scopeId=segmento-que-nao-existe`,
    { headers: { cookie } }
  );
  assert.equal(response.status, 404);
});

test("mapa de rede por escopo: escopo nao suportado devolve 400", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const response = await fetch(
    `${baseUrl}/api/topology-maps/by-scope?scopeType=inventory_tab&scopeId=qualquer`,
    { headers: { cookie } }
  );
  assert.equal(response.status, 400);
});

test("mapa de rede por escopo: acesso sem sessao e recusado", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const response = await fetch(`${baseUrl}/api/topology-maps/by-scope?scopeType=segment&scopeId=qualquer`);
  assert.equal(response.status, 401);
});

test("mapa de rede por escopo: usuario sem permissao de visualizar recebe 403", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const noPermissionUser = await createUser({
    name: "Sem Permissao Topologia",
    email: "no-topo-view@itguardian.test",
    password: "not-used-in-this-test",
    role: "viewer"
  });
  const noPermissionToken = jwt.sign({ sub: noPermissionUser.id }, process.env.JWT_SECRET, { expiresIn: "1h" });

  const response = await fetch(`${baseUrl}/api/topology-maps/by-scope?scopeType=segment&scopeId=qualquer`, {
    headers: {
      authorization: `Bearer ${noPermissionToken}`,
      origin: trustedOrigin
    }
  });
  // "viewer" nao tem nenhuma permissao por padrao (roleDefaultPermissions.viewer = []).
  assert.equal(response.status, 403);
});
