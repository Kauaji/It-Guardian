import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "remote-assistance-rustdesk-integration-secret-32";
process.env.NODE_ENV = "test";
process.env.ENABLE_REMOTE_ASSISTANCE = "true";
process.env.REMOTE_ASSISTANCE_ENV = "lab";
process.env.REMOTE_ASSISTANCE_LAB_AUTO_CONSENT = "true";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");
const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");

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

function browserHeaders(cookie, extra = {}) {
  return { "content-type": "application/json", cookie, origin: trustedOrigin, ...extra };
}

async function heartbeat(baseUrl, enrollmentToken, machineId) {
  const response = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollmentToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      machineId,
      hostname: "LAB-RUSTDESK-01",
      machineAlias: "Notebook RustDesk lab",
      operatingSystem: "Microsoft Windows 11 Pro",
      osArchitecture: "64-bit",
      windowsVersion: "23H2",
      localIp: "192.168.60.30",
      macAddress: "00-11-22-33-66-88",
      cpuModel: "Intel Core i7",
      memoryTotalBytes: 17179869184,
      diskTotalBytes: 512000000000,
      diskFreeBytes: 256000000000,
      uptimeSeconds: 7200,
      agentVersion: "1.0.0",
      collectedAt: new Date().toISOString(),
      intervalSeconds: 60,
      environment: "Laboratorio",
      group: "Suporte",
      segment: "Windows",
      inventoryDetails: { cpuCores: 8, software: [] }
    })
  });
  assert.equal(response.status, 202);
}

async function startActiveSession(baseUrl, cookie, enrollmentToken, machineId) {
  const reauth = await fetch(`${baseUrl}/api/security/reauthenticate`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ password: "123456", action: "remote_assistance_start", assetId: machineId })
  });
  assert.equal(reauth.status, 200);
  const { token } = await reauth.json();

  const started = await fetch(`${baseUrl}/api/remote-assistance/assets/${machineId}/sessions`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({
      reauthenticationToken: token,
      requestedMode: "view",
      reason: "Sessao de teste do transporte RustDesk"
    })
  });
  assert.equal(started.status, 201);
  const { session, viewerToken } = await started.json();

  const pending = await fetch(`${baseUrl}/api/agents/remote-assistance/pending`, {
    headers: { authorization: `Bearer ${enrollmentToken}` }
  });
  const pendingSession = (await pending.json()).session;
  assert.equal(pendingSession.id, session.id);

  const consent = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${session.id}/consent`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${enrollmentToken}`,
        "x-remote-session-token": pendingSession.sessionToken,
        "content-type": "application/json"
      },
      body: JSON.stringify({ granted: true, controlAllowed: false, monitors: [], selectedMonitorId: null })
    }
  );
  assert.equal(consent.status, 200);
  return { sessionId: session.id, viewerToken, agentSessionToken: pendingSession.sessionToken };
}

test.after(closeDatabase);

test("pedir transporte rustdesk sem relay proprio configurado cai para snapshot_polling", async (t) => {
  process.env.REMOTE_ASSISTANCE_TRANSPORT = "rustdesk";
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete process.env.REMOTE_ASSISTANCE_TRANSPORT;
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const config = await fetch(`${baseUrl}/api/remote-assistance/config`, { headers: { cookie } });
  const body = await config.json();
  assert.equal(body.transport, "snapshot_polling");
  assert.equal(body.transportFallback, true);
  assert.equal(body.rustdeskEnabled, false);
});

test("com relay proprio configurado, agente reporta id e tecnico revela credencial de sessao apos consentimento", async (t) => {
  process.env.REMOTE_ASSISTANCE_TRANSPORT = "rustdesk";
  process.env.REMOTE_ASSISTANCE_RUSTDESK_ENABLED = "true";
  process.env.REMOTE_ASSISTANCE_RUSTDESK_ID_SERVER = "id.lab.interno:21116";
  await initializeRuntime();
  const machineId = "remote-assistance-rustdesk-machine-on";
  const enrollment = await createAgentEnrollment({ name: "Laboratorio RustDesk ligado" });
  const server = await listen(createApp());
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete process.env.REMOTE_ASSISTANCE_TRANSPORT;
    delete process.env.REMOTE_ASSISTANCE_RUSTDESK_ENABLED;
    delete process.env.REMOTE_ASSISTANCE_RUSTDESK_ID_SERVER;
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  await heartbeat(baseUrl, enrollment.token, machineId);

  const reportBeforeId = await fetch(`${baseUrl}/api/agents/remote-assistance/rustdesk-id`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify({ rustdeskId: "" })
  });
  assert.equal(reportBeforeId.status, 400);

  const reportId = await fetch(`${baseUrl}/api/agents/remote-assistance/rustdesk-id`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify({ rustdeskId: "987654321" })
  });
  assert.equal(reportId.status, 200);
  assert.equal((await reportId.json()).rustdeskId, "987654321");

  const cookie = await login(baseUrl);
  const { sessionId, viewerToken } = await startActiveSession(baseUrl, cookie, enrollment.token, machineId);

  const credentials = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${sessionId}/rustdesk-credentials`,
    { headers: browserHeaders(cookie, { "x-remote-viewer-token": viewerToken }) }
  );
  assert.equal(credentials.status, 200);
  const credentialsBody = await credentials.json();
  assert.equal(credentialsBody.rustdeskId, "987654321");
  assert.equal(typeof credentialsBody.password, "string");
  assert.equal(credentialsBody.password.length, 16);
  assert.ok(new Date(credentialsBody.expiresAt).getTime() > Date.now());

  const events = await fetch(`${baseUrl}/api/remote-assistance/sessions/${sessionId}/events`, {
    headers: { cookie }
  });
  const eventTypes = (await events.json()).events.map((event) => event.eventType);
  assert.ok(eventTypes.includes("rustdesk_password_issued"));
  assert.ok(eventTypes.includes("rustdesk_credentials_revealed"));

  const ended = await fetch(`${baseUrl}/api/remote-assistance/sessions/${sessionId}/end`, {
    method: "POST",
    headers: browserHeaders(cookie, { "x-remote-viewer-token": viewerToken })
  });
  assert.equal(ended.status, 200);

  // Encerrar a sessao invalida o proprio viewer token (nao so o status) --
  // uma tentativa de reler a credencial com o token antigo cai em 401 antes
  // mesmo de chegar na checagem de sessao ativa.
  const credentialsAfterEnd = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${sessionId}/rustdesk-credentials`,
    { headers: browserHeaders(cookie, { "x-remote-viewer-token": viewerToken }) }
  );
  assert.equal(credentialsAfterEnd.status, 401);
});
