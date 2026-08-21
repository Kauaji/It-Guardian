import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "public-service-order-integration-secret-32-chars";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");
const { createProductKey, activateCollector } = await import("../src/repositories/productKeyRepository.js");
const { createPublicMachineToken } = await import("../src/domain/publicMachineToken.js");
const { honeypotFieldName } = await import("../src/services/publicServiceOrderService.js");

const trustedOrigin = "http://localhost:5173";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function login(baseUrl, email = "admin@itguardian.local") {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "123456" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

function browserHeaders(cookie) {
  return { "content-type": "application/json", cookie, origin: trustedOrigin };
}

function heartbeatPayload(machineId, overrides = {}) {
  return {
    machineId,
    hostname: machineId.toUpperCase(),
    operatingSystem: "Microsoft Windows 11 Pro",
    osArchitecture: "64-bit",
    windowsVersion: "23H2",
    localIp: "192.168.80.10",
    macAddress: "00-11-22-33-99-00",
    cpuModel: "Intel Core i5",
    memoryTotalBytes: 17179869184,
    diskTotalBytes: 512000000000,
    diskFreeBytes: 256000000000,
    uptimeSeconds: 3600,
    agentVersion: "1.0.0",
    collectedAt: new Date().toISOString(),
    intervalSeconds: 60,
    ...overrides
  };
}

async function enrollAndActivate(baseUrl, machineId) {
  const { productKey, key } = await createProductKey({
    displayName: `Cliente teste ${machineId}`,
    organizationName: "Organizacao de teste",
    planName: "Plano de teste",
    activationLimit: 5
  });
  const activation = await activateCollector({
    productKey: key,
    machineFingerprint: `fingerprint-${machineId}`,
    hostname: machineId.toUpperCase(),
    collectorVersion: "1.0.0"
  });

  const heartbeat = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${activation.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload(machineId))
  });
  assert.equal(heartbeat.status, 202);

  return { activationId: activation.activation.id, machineId, productKeyId: productKey.id };
}

async function getRealProblemType(baseUrl) {
  const response = await fetch(`${baseUrl}/api/public/support-options`);
  assert.equal(response.status, 200);
  const body = await response.json();
  return body.problemTypes[0];
}

function basePayload(overrides = {}) {
  return {
    title: "Computador lento",
    description: "O computador demora muito para abrir programas.",
    category: "Computador",
    requesterName: "Fulano de Tal",
    problemType: "default-computer-power",
    ...overrides
  };
}

test.after(closeDatabase);

test("abre chamado publico sem maquina vinculada, com origem e prioridade corretas", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const problemType = await getRealProblemType(baseUrl);
  const createResponse = await fetch(`${baseUrl}/api/public/service-orders`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify(basePayload({ problemType: problemType.id }))
  });
  const createBody = await createResponse.json();
  assert.equal(createResponse.status, 201, JSON.stringify(createBody));
  assert.ok(createBody.serviceOrder.number);
  assert.equal(createBody.serviceOrder.priority, problemType.defaultPriority);
  assert.ok(createBody.serviceOrder.trackingToken, "resposta deve incluir o token de acompanhamento");

  const listResponse = await fetch(`${baseUrl}/api/service-orders`, { headers: { cookie } });
  const listBody = await listResponse.json();
  const created = listBody.serviceOrders.find((order) => order.number === createBody.serviceOrder.number);
  assert.ok(created, "a OS deve aparecer na listagem interna");
  assert.equal(created.source, "public_support_form");
  assert.equal(created.assetId || null, null);
});

test("abre chamado publico com token de maquina valido vincula o ativo real", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  const machineId = "public-form-linked-asset";
  const { activationId } = await enrollAndActivate(baseUrl, machineId);
  const deviceToken = createPublicMachineToken(activationId);

  const problemType = await getRealProblemType(baseUrl);
  const createResponse = await fetch(`${baseUrl}/api/public/service-orders`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify(basePayload({ problemType: problemType.id, deviceToken, machineScope: "mine" }))
  });
  const createBody = await createResponse.json();
  assert.equal(createResponse.status, 201, JSON.stringify(createBody));

  const listResponse = await fetch(`${baseUrl}/api/service-orders`, { headers: { cookie } });
  const listBody = await listResponse.json();
  const created = listBody.serviceOrders.find((order) => order.number === createBody.serviceOrder.number);
  assert.equal(created.assetId, machineId);
});

test("token de maquina invalido nao quebra o formulario, so recusa o vinculo", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const problemType = await getRealProblemType(baseUrl);
  const createResponse = await fetch(`${baseUrl}/api/public/service-orders`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify(basePayload({ problemType: problemType.id, deviceToken: "token-invalido-forjado", machineScope: "mine" }))
  });
  assert.equal(createResponse.status, 400);
});

test("machineScope 'other' com assetId forjado nao vincula nem coloca o ativo em manutencao (correcao de seguranca)", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  const machineId = "public-form-guessed-asset";
  await enrollAndActivate(baseUrl, machineId);

  const beforeResponse = await fetch(`${baseUrl}/api/devices/${machineId}`, { headers: { cookie } });
  const beforeBody = await beforeResponse.json();
  assert.notEqual(beforeBody.device?.segmentId, "maintenance", "o ativo nao deve comecar em manutencao");

  const problemType = await getRealProblemType(baseUrl);
  const createResponse = await fetch(`${baseUrl}/api/public/service-orders`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify(
      basePayload({ problemType: problemType.id, machineScope: "other", assetId: machineId })
    )
  });
  const createBody = await createResponse.json();
  assert.equal(createResponse.status, 201, JSON.stringify(createBody));

  const listResponse = await fetch(`${baseUrl}/api/service-orders`, { headers: { cookie } });
  const listBody = await listResponse.json();
  const created = listBody.serviceOrders.find((order) => order.number === createBody.serviceOrder.number);
  assert.equal(created.assetId || null, null, "assetId enviado pelo cliente em machineScope=other nunca deve ser aceito");

  const afterResponse = await fetch(`${baseUrl}/api/devices/${machineId}`, { headers: { cookie } });
  const afterBody = await afterResponse.json();
  assert.notEqual(afterBody.device?.segmentId, "maintenance", "o ativo forjado nao deve ter sido colocado em manutencao");
});

test("payload invalido retorna 400 e campos longos sao cortados no limite configurado", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const missingTitle = await fetch(`${baseUrl}/api/public/service-orders`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify(basePayload({ title: "" }))
  });
  assert.equal(missingTitle.status, 400);

  const problemType = await getRealProblemType(baseUrl);
  const longTitle = "T".repeat(500);
  const createResponse = await fetch(`${baseUrl}/api/public/service-orders`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify(basePayload({ problemType: problemType.id, title: longTitle }))
  });
  const createBody = await createResponse.json();
  assert.equal(createResponse.status, 201, JSON.stringify(createBody));

  const listResponse = await fetch(`${baseUrl}/api/service-orders`, { headers: { cookie } });
  const listBody = await listResponse.json();
  const created = listBody.serviceOrders.find((order) => order.number === createBody.serviceOrder.number);
  assert.ok(created.title.length <= 200, "titulo deve ser cortado no limite maximo configurado");
});

test("checklist e aplicado automaticamente quando ha template ativo para o tipo de problema", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const problemType = await getRealProblemType(baseUrl);
  const templateResponse = await fetch(`${baseUrl}/api/service-order-checklist-templates`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({
      name: "Checklist para chamado publico",
      problemTypeKey: problemType.id,
      items: [{ label: "Confirmar problema relatado", required: true }]
    })
  });
  assert.equal(templateResponse.status, 201);

  const createResponse = await fetch(`${baseUrl}/api/public/service-orders`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify(basePayload({ problemType: problemType.id }))
  });
  const createBody = await createResponse.json();
  assert.equal(createResponse.status, 201, JSON.stringify(createBody));

  const listResponse = await fetch(`${baseUrl}/api/service-orders`, { headers: { cookie } });
  const listBody = await listResponse.json();
  const created = listBody.serviceOrders.find((order) => order.number === createBody.serviceOrder.number);

  const checklistResponse = await fetch(`${baseUrl}/api/service-orders/${created.id}/checklist`, { headers: { cookie } });
  const checklistBody = await checklistResponse.json();
  assert.equal(checklistResponse.status, 200);
  assert.equal(checklistBody.items.length, 1, "o template ativo deve ser aplicado automaticamente na OS publica");
});

test("campo honeypot preenchido retorna sucesso falso sem criar OS de verdade", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const beforeResponse = await fetch(`${baseUrl}/api/service-orders`, { headers: { cookie } });
  const beforeBody = await beforeResponse.json();
  const beforeCount = beforeBody.serviceOrders.length;

  const problemType = await getRealProblemType(baseUrl);
  const honeypotResponse = await fetch(`${baseUrl}/api/public/service-orders`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify(basePayload({ problemType: problemType.id, [honeypotFieldName]: "http://spam.example" }))
  });
  const honeypotBody = await honeypotResponse.json();
  assert.equal(honeypotResponse.status, 201, JSON.stringify(honeypotBody));
  assert.ok(honeypotBody.serviceOrder.number, "resposta deve parecer uma OS real, com numero");

  const afterResponse = await fetch(`${baseUrl}/api/service-orders`, { headers: { cookie } });
  const afterBody = await afterResponse.json();
  assert.equal(afterBody.serviceOrders.length, beforeCount, "nenhuma OS de verdade deve ter sido criada");
});

test("limite de escrita do formulario publico e aplicado", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const problemType = await getRealProblemType(baseUrl);
  let lastStatus = 0;
  for (let attempt = 0; attempt < 21; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/public/service-orders`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: trustedOrigin, "x-forwarded-for": "203.0.113.77" },
      body: JSON.stringify(basePayload({ problemType: problemType.id, title: `Chamado ${attempt}` }))
    });
    lastStatus = response.status;
  }
  assert.equal(lastStatus, 429, "a vigesima primeira tentativa da mesma origem deve ser recusada pelo rate limit");
});

test("endpoint de acompanhamento retorna somente campos seguros e nunca o id interno", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const problemType = await getRealProblemType(baseUrl);
  const createResponse = await fetch(`${baseUrl}/api/public/service-orders`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify(basePayload({ problemType: problemType.id }))
  });
  const createBody = await createResponse.json();
  assert.equal(createResponse.status, 201);

  const listResponse = await fetch(`${baseUrl}/api/service-orders`, { headers: { cookie } });
  const listBody = await listResponse.json();
  const created = listBody.serviceOrders.find((order) => order.number === createBody.serviceOrder.number);

  const trackResponse = await fetch(`${baseUrl}/api/public/service-orders/track/${createBody.serviceOrder.trackingToken}`);
  const trackBody = await trackResponse.json();
  assert.equal(trackResponse.status, 200, JSON.stringify(trackBody));
  assert.equal(trackBody.tracking.number, createBody.serviceOrder.number);
  assert.equal(trackBody.tracking.status, createBody.serviceOrder.status);
  assert.ok(trackBody.tracking.sla);
  assert.equal(JSON.stringify(trackBody.tracking).includes(created.id), false, "resposta nao deve conter o id interno da OS");
  assert.equal(Object.keys(trackBody.tracking).includes("history"), false);
  assert.equal(Object.keys(trackBody.tracking).includes("technician"), false);

  const invalidTrackResponse = await fetch(`${baseUrl}/api/public/service-orders/track/token-invalido`);
  assert.equal(invalidTrackResponse.status, 404);
});
