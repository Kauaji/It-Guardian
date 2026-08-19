import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "asset-timeline-integration-secret-32-chars";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { createUser } = await import("../src/repositories/userRepository.js");
const { upsertAlert } = await import("../src/repositories/alertRepository.js");
const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");
const {
  createRemoteAssistanceSession,
  addRemoteAssistanceEvent
} = await import("../src/repositories/remoteAssistanceRepository.js");
const { default: jwt } = await import("jsonwebtoken");
const { query, closeDatabase } = await import("../src/database.js");
const { syncSlaBreaches } = await import("../src/repositories/serviceOrderRepository.js");

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
      assetTag: `TIMELINE-${name}`,
      ip: "203.0.113.90"
    })
  });
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  return body.device;
}

async function bearerUser(role) {
  const user = await createUser({
    name: `Usuario ${role}`,
    email: `${role}-${Date.now()}@timeline.local`,
    password: "senha-segura-123",
    role
  });
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  return { user, token };
}

test("prontuario tecnico do ativo: consolida OS, alerta, manutencao e mapa de rede", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const asset = await createManualAsset(baseUrl, cookie, "PatrimonioTimeline1");

  const segmentResponse = await fetch(`${baseUrl}/api/segments`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ name: "Manutencao Timeline" })
  });
  const segmentBody = await segmentResponse.json();
  assert.equal(segmentResponse.status, 201, JSON.stringify(segmentBody));

  const maintenanceResponse = await fetch(`${baseUrl}/api/devices/${asset.id}/segment`, {
    method: "PATCH",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ segmentId: segmentBody.segment.id, reason: "maintenance" })
  });
  assert.equal(maintenanceResponse.status, 200);

  const now = Date.now();
  await upsertAlert({
    id: `timeline-alert-${asset.id}`,
    assetId: asset.id,
    hostName: asset.name,
    type: "disk_health_low",
    metric: "disk_health",
    title: "Disco critico",
    description: "Alerta deterministico criado pelo teste de prontuario tecnico.",
    severity: "critical",
    value: 95,
    threshold: 80,
    status: "resolved",
    firstSeenAt: new Date(now - 60 * 60 * 1000).toISOString(),
    lastSeenAt: new Date(now - 30 * 60 * 1000).toISOString(),
    occurrencesCount: 1,
    source: "integration_test"
  });

  const createOrderResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ title: "Falha de rede intermitente", priority: "high", assetId: asset.id })
  });
  const orderBody = await createOrderResponse.json();
  assert.equal(createOrderResponse.status, 201, JSON.stringify(orderBody));
  const order = orderBody.serviceOrder;

  const assignTechnicianResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/technician`, {
    method: "PATCH",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ assignedTechnicianName: "Tecnico Timeline" })
  });
  assert.equal(assignTechnicianResponse.status, 200);

  const closeOrderResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/status`, {
    method: "PATCH",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ status: "closed" })
  });
  assert.equal(closeOrderResponse.status, 200);

  const createMapResponse = await fetch(`${baseUrl}/api/topology-maps`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ name: "Mapa Prontuario Teste" })
  });
  const mapBody = await createMapResponse.json();
  assert.equal(createMapResponse.status, 201, JSON.stringify(mapBody));

  const createNodeResponse = await fetch(`${baseUrl}/api/topology-maps/${mapBody.map.id}/nodes`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ assetId: asset.id, x: 10, y: 10 })
  });
  assert.equal(createNodeResponse.status, 201);

  const timelineResponse = await fetch(`${baseUrl}/api/devices/${asset.id}/timeline`, { headers: { cookie } });
  const timelineBody = await timelineResponse.json();
  assert.equal(timelineResponse.status, 200, JSON.stringify(timelineBody));

  const types = timelineBody.events.map((event) => event.type);
  assert.ok(types.includes("service_order_created"), "deve incluir abertura da OS");
  assert.ok(types.includes("service_order_closed"), "deve incluir fechamento da OS");
  assert.ok(types.includes("alert_created"), "deve incluir criacao do alerta");
  assert.ok(types.includes("alert_resolved"), "deve incluir resolucao do alerta");
  assert.ok(types.includes("maintenance"), "deve incluir entrada em manutencao");
  assert.ok(types.includes("network_topology_node_added"), "deve incluir vinculo com o mapa de rede");

  assert.equal(timelineBody.summary.serviceOrdersOpened, 1);
  assert.equal(timelineBody.summary.serviceOrdersClosed, 1);
  assert.equal(timelineBody.summary.criticalAlerts, 1);
  assert.equal(timelineBody.topologyReferences.mapCount, 1);

  // Ordem cronologica: mais recente primeiro.
  const timestamps = timelineBody.events.map((event) => new Date(event.occurredAt).getTime());
  const sorted = [...timestamps].sort((a, b) => b - a);
  assert.deepEqual(timestamps, sorted, "eventos devem vir do mais recente para o mais antigo");

  const filteredResponse = await fetch(
    `${baseUrl}/api/devices/${asset.id}/timeline?category=service_order`,
    { headers: { cookie } }
  );
  const filteredBody = await filteredResponse.json();
  assert.equal(filteredResponse.status, 200);
  assert.ok(filteredBody.events.length >= 2);
  assert.ok(filteredBody.events.every((event) => event.category === "service_order"));

  const pagedResponse = await fetch(`${baseUrl}/api/devices/${asset.id}/timeline?limit=1&offset=0`, {
    headers: { cookie }
  });
  const pagedBody = await pagedResponse.json();
  assert.equal(pagedResponse.status, 200);
  assert.equal(pagedBody.events.length, 1);
  assert.equal(pagedBody.metadata.limit, 1);
  assert.ok(pagedBody.metadata.total >= 6);

  const { token: viewerToken } = await bearerUser("viewer");
  const viewerResponse = await fetch(`${baseUrl}/api/devices/${asset.id}/timeline`, {
    headers: { authorization: `Bearer ${viewerToken}` }
  });
  assert.equal(viewerResponse.status, 403, "role viewer nao tem inventory.view_machine por padrao");
});

test("prontuario tecnico do ativo: assistencia remota so aparece para quem tem remote_assistance.view", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const machineId = "timeline-remote-assistance-machine";
  const { token: enrollmentToken } = await createAgentEnrollment({ name: "Agente Timeline" });

  const heartbeatResponse = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollmentToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      machineId,
      hostname: "TIMELINE-RA-01",
      operatingSystem: "Microsoft Windows 11 Pro",
      osArchitecture: "64-bit",
      localIp: "192.168.60.20",
      macAddress: "00-11-22-33-44-77",
      cpuModel: "Intel Core i5",
      memoryTotalBytes: 8589934592,
      diskTotalBytes: 256000000000,
      diskFreeBytes: 128000000000,
      uptimeSeconds: 3600,
      agentVersion: "1.0.0",
      collectedAt: new Date().toISOString(),
      intervalSeconds: 60
    })
  });
  assert.equal(heartbeatResponse.status, 202);

  const session = await createRemoteAssistanceSession({
    assetId: machineId,
    status: "ended",
    requestedMode: "view",
    consentRequired: true,
    consentStatus: "granted",
    viewerTokenHash: "viewer-hash-timeline-test",
    agentTokenHash: "agent-hash-timeline-test",
    reason: "Suporte remoto para teste do prontuario",
    environment: "Laboratorio",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });

  await addRemoteAssistanceEvent({
    sessionId: session.id,
    assetId: machineId,
    actorType: "technician",
    actorName: "Tecnico Teste",
    eventType: "session_started",
    message: "Sessao de assistencia remota iniciada."
  });

  const adminResponse = await fetch(`${baseUrl}/api/devices/${machineId}/timeline`, { headers: { cookie } });
  const adminBody = await adminResponse.json();
  assert.equal(adminResponse.status, 200, JSON.stringify(adminBody));
  assert.ok(
    adminBody.events.some((event) => event.category === "remote_assistance"),
    "admin tem remote_assistance.view e deve ver a categoria"
  );

  const { token: operatorToken } = await bearerUser("operator");
  const operatorResponse = await fetch(`${baseUrl}/api/devices/${machineId}/timeline`, {
    headers: { authorization: `Bearer ${operatorToken}` }
  });
  const operatorBody = await operatorResponse.json();
  assert.equal(operatorResponse.status, 200, JSON.stringify(operatorBody));
  assert.ok(
    operatorBody.events.every((event) => event.category !== "remote_assistance"),
    "operator tem inventory.view_machine mas nao remote_assistance.view - categoria deve ficar de fora"
  );
});

test.after(closeDatabase);

test("prontuario tecnico do ativo: inclui SLA vencido, reabertura e avaliacao da OS", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const asset = await createManualAsset(baseUrl, cookie, "PatrimonioTimelineSla1");

  // OS separada para o SLA vencido: reabrir uma OS limpa sla_breached_at (o
  // prazo e recalculado do zero), entao testar os 3 eventos na mesma OS
  // faria o evento de vencimento desaparecer antes de checar a timeline.
  const slaOrderResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ title: "OS com SLA vencido", priority: "critical", assetId: asset.id })
  });
  const slaOrder = (await slaOrderResponse.json()).serviceOrder;
  await query("UPDATE service_orders SET sla_due_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [slaOrder.id]);
  const syncResult = await syncSlaBreaches();
  assert.ok(syncResult.breached >= 1);

  const order = (await (await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ title: "OS com reabertura e avaliacao", assetId: asset.id })
  })).json()).serviceOrder;

  await fetch(`${baseUrl}/api/service-orders/${order.id}/technician`, {
    method: "PATCH",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ assignedTechnicianName: "Tecnico Timeline SLA" })
  });
  await fetch(`${baseUrl}/api/service-orders/${order.id}/status`, {
    method: "PATCH",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ status: "closed" })
  });
  const reopenResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/reopen`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ reason: "Problema voltou a ocorrer apos o fechamento." })
  });
  assert.equal(reopenResponse.status, 200);

  const feedbackResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/feedback`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ rating: 5, comment: "Atendimento resolvido apos a reabertura." })
  });
  assert.equal(feedbackResponse.status, 201);

  const timelineResponse = await fetch(`${baseUrl}/api/devices/${asset.id}/timeline`, { headers: { cookie } });
  const timelineBody = await timelineResponse.json();
  assert.equal(timelineResponse.status, 200, JSON.stringify(timelineBody));

  const types = timelineBody.events.map((event) => event.type);
  assert.ok(types.includes("service_order_sla_breached"), "deve incluir o evento de SLA vencido");
  assert.ok(types.includes("service_order_reopened"), "deve incluir o evento de reabertura");
  assert.ok(types.includes("service_order_feedback_submitted"), "deve incluir o evento de avaliacao");
});
