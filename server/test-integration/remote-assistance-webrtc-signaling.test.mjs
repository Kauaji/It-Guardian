import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "remote-assistance-webrtc-integration-secret-32";
process.env.NODE_ENV = "test";
process.env.ENABLE_REMOTE_ASSISTANCE = "true";
process.env.REMOTE_ASSISTANCE_ENV = "lab";
process.env.REMOTE_ASSISTANCE_LAB_AUTO_CONSENT = "true";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");
const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");

const trustedOrigin = "http://localhost:5173";
const validOffer = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n";
const validAnswer = "v=0\r\no=- 1 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n";

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
      hostname: "LAB-WEBRTC-01",
      machineAlias: "Notebook WebRTC lab",
      operatingSystem: "Microsoft Windows 11 Pro",
      osArchitecture: "64-bit",
      windowsVersion: "23H2",
      localIp: "192.168.60.20",
      macAddress: "00-11-22-33-55-77",
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
      reason: "Sessao de teste do contrato WebRTC"
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

test("sinalizacao WebRTC permanece bloqueada enquanto a flag estiver desligada", async (t) => {
  await initializeRuntime();
  const machineId = "remote-assistance-webrtc-machine-off";
  const enrollment = await createAgentEnrollment({ name: "Laboratorio WebRTC desligado" });
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  await heartbeat(baseUrl, enrollment.token, machineId);
  const cookie = await login(baseUrl);
  const { sessionId, viewerToken } = await startActiveSession(baseUrl, cookie, enrollment.token, machineId);

  const offerAttempt = await fetch(`${baseUrl}/api/remote-assistance/sessions/${sessionId}/webrtc/offer`, {
    method: "POST",
    headers: browserHeaders(cookie, { "x-remote-viewer-token": viewerToken }),
    body: JSON.stringify({ sdp: validOffer })
  });
  assert.equal(offerAttempt.status, 409);
  const body = await offerAttempt.json();
  assert.match(body.error || body.message || "", /webrtc/i);
});

test("com a flag ligada, oferta e resposta SDP sao relayadas com autenticacao propria de cada lado", async (t) => {
  process.env.REMOTE_ASSISTANCE_WEBRTC_ENABLED = "true";
  await initializeRuntime();
  const machineId = "remote-assistance-webrtc-machine-on";
  const enrollment = await createAgentEnrollment({ name: "Laboratorio WebRTC ligado" });
  const server = await listen(createApp());
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete process.env.REMOTE_ASSISTANCE_WEBRTC_ENABLED;
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  await heartbeat(baseUrl, enrollment.token, machineId);
  const cookie = await login(baseUrl);
  const { sessionId, viewerToken, agentSessionToken } = await startActiveSession(baseUrl, cookie, enrollment.token, machineId);

  const missingOffer = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${sessionId}/webrtc/offer`,
    { headers: { authorization: `Bearer ${enrollment.token}`, "x-remote-session-token": agentSessionToken } }
  );
  assert.equal(missingOffer.status, 200);
  assert.equal((await missingOffer.json()).offer, null);

  const invalidOffer = await fetch(`${baseUrl}/api/remote-assistance/sessions/${sessionId}/webrtc/offer`, {
    method: "POST",
    headers: browserHeaders(cookie, { "x-remote-viewer-token": viewerToken }),
    body: JSON.stringify({ sdp: "not-a-valid-sdp-payload" })
  });
  assert.equal(invalidOffer.status, 400);

  const offerResponse = await fetch(`${baseUrl}/api/remote-assistance/sessions/${sessionId}/webrtc/offer`, {
    method: "POST",
    headers: browserHeaders(cookie, { "x-remote-viewer-token": viewerToken }),
    body: JSON.stringify({ sdp: validOffer })
  });
  assert.equal(offerResponse.status, 202);

  const offerWithoutViewerToken = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${sessionId}/webrtc/answer`,
    { headers: { cookie } }
  );
  assert.equal(offerWithoutViewerToken.status, 401);

  const agentReadsOffer = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${sessionId}/webrtc/offer`,
    { headers: { authorization: `Bearer ${enrollment.token}`, "x-remote-session-token": agentSessionToken } }
  );
  assert.equal(agentReadsOffer.status, 200);
  assert.equal((await agentReadsOffer.json()).offer, validOffer.trim());

  const agentAnswers = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${sessionId}/webrtc/answer`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${enrollment.token}`,
        "x-remote-session-token": agentSessionToken,
        "content-type": "application/json"
      },
      body: JSON.stringify({ sdp: validAnswer })
    }
  );
  assert.equal(agentAnswers.status, 202);

  const viewerReadsAnswer = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${sessionId}/webrtc/answer`,
    { headers: { cookie, "x-remote-viewer-token": viewerToken } }
  );
  assert.equal(viewerReadsAnswer.status, 200);
  assert.equal((await viewerReadsAnswer.json()).answer, validAnswer.trim());

  const wrongAgentToken = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${sessionId}/webrtc/offer`,
    { headers: { authorization: `Bearer ${enrollment.token}`, "x-remote-session-token": "wrong-token" } }
  );
  assert.equal(wrongAgentToken.status, 401);
});
