import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "remote-assistance-frame-relay-integration-secret-32";
process.env.NODE_ENV = "test";
process.env.ENABLE_REMOTE_ASSISTANCE = "true";
process.env.REMOTE_ASSISTANCE_ENV = "lab";
process.env.REMOTE_ASSISTANCE_LAB_AUTO_CONSENT = "true";
process.env.REMOTE_ASSISTANCE_MAX_FPS = "5";

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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      hostname: "LAB-FRAME-RELAY-01",
      machineAlias: "Notebook do relay de frames",
      operatingSystem: "Microsoft Windows 11 Pro",
      osArchitecture: "64-bit",
      windowsVersion: "23H2",
      localIp: "192.168.70.20",
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
      reason: "Sessao de teste do relay de frames"
    })
  });
  assert.equal(started.status, 201);
  const { session, viewerToken } = await started.json();

  const pending = await fetch(`${baseUrl}/api/agents/remote-assistance/pending`, {
    headers: { authorization: `Bearer ${enrollmentToken}` }
  });
  const pendingSession = (await pending.json()).session;

  const consent = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${session.id}/consent`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${enrollmentToken}`,
        "x-remote-session-token": pendingSession.sessionToken,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        granted: true,
        controlAllowed: false,
        monitors: [{ id: "display-1", name: "Monitor 1", primary: true, width: 1920, height: 1080 }],
        selectedMonitorId: "display-1"
      })
    }
  );
  assert.equal(consent.status, 200);
  return { sessionId: session.id, viewerToken, agentSessionToken: pendingSession.sessionToken };
}

async function postFrame(baseUrl, { sessionId, agentSessionToken, enrollmentToken, frame, monitors, selectedMonitorId }) {
  return fetch(`${baseUrl}/api/agents/remote-assistance/sessions/${sessionId}/frame`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollmentToken}`,
      "x-remote-session-token": agentSessionToken,
      "content-type": "application/json"
    },
    body: JSON.stringify({ frame, monitors, selectedMonitorId })
  });
}

async function readSession(baseUrl, cookie, sessionId) {
  const response = await fetch(`${baseUrl}/api/remote-assistance/sessions/${sessionId}`, {
    headers: { cookie }
  });
  assert.equal(response.status, 200);
  return (await response.json()).session;
}

test.after(closeDatabase);

test("o frame fica acessivel ao viewer por uma chave propria, separada dos metadados da sessao", async (t) => {
  await initializeRuntime();
  const machineId = "remote-assistance-frame-relay-machine-basic";
  const enrollment = await createAgentEnrollment({ name: "Laboratorio relay de frames" });
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  await heartbeat(baseUrl, enrollment.token, machineId);
  const cookie = await login(baseUrl);
  const { sessionId, viewerToken, agentSessionToken } = await startActiveSession(baseUrl, cookie, enrollment.token, machineId);

  const frameA = "data:image/jpeg;base64,QUFB";
  const postA = await postFrame(baseUrl, {
    sessionId,
    agentSessionToken,
    enrollmentToken: enrollment.token,
    frame: frameA
  });
  assert.equal(postA.status, 202);

  const viewerFrame = await fetch(`${baseUrl}/api/remote-assistance/sessions/${sessionId}/frame`, {
    headers: { cookie, "x-remote-viewer-token": viewerToken }
  });
  assert.equal(viewerFrame.status, 200);
  const viewerFrameBody = await viewerFrame.json();
  assert.equal(viewerFrameBody.frame, frameA);
  assert.equal(viewerFrameBody.metrics.framesTotal, 1);

  // Um GET de sessao (usado para status/monitores/metrics) nunca precisa dos
  // bytes do JPEG -- so confere que o metadado continua correto mesmo sem
  // tocar na chave de frame.
  const session = await readSession(baseUrl, cookie, sessionId);
  assert.equal(session.hasFrame, true);
  assert.equal(session.monitors[0].id, "display-1");
});

test("postar a mesma lista de monitores em frames seguidos nao corrompe o monitor selecionado, e uma mudanca real ainda e aplicada", async (t) => {
  await initializeRuntime();
  const machineId = "remote-assistance-frame-relay-machine-monitors";
  const enrollment = await createAgentEnrollment({ name: "Laboratorio relay de frames (monitores)" });
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  await heartbeat(baseUrl, enrollment.token, machineId);
  const cookie = await login(baseUrl);
  const { sessionId, agentSessionToken } = await startActiveSession(baseUrl, cookie, enrollment.token, machineId);

  const monitors = [{ id: "display-1", name: "Monitor 1", primary: true, width: 1920, height: 1080 }];

  const postA = await postFrame(baseUrl, {
    sessionId,
    agentSessionToken,
    enrollmentToken: enrollment.token,
    frame: "data:image/jpeg;base64,QUFB",
    monitors,
    selectedMonitorId: "display-1"
  });
  assert.equal(postA.status, 202);
  assert.equal((await readSession(baseUrl, cookie, sessionId)).selectedMonitorId, "display-1");

  await wait(220);
  // Mesma lista de monitores e o mesmo monitor selecionado: o agente manda
  // isso em todo frame, entao esse segundo post deve deixar o estado exatamente
  // como estava (o caminho que passou a pular a escrita redundante no relay).
  const postB = await postFrame(baseUrl, {
    sessionId,
    agentSessionToken,
    enrollmentToken: enrollment.token,
    frame: "data:image/jpeg;base64,QkJC",
    monitors,
    selectedMonitorId: "display-1"
  });
  assert.equal(postB.status, 202);
  const afterUnchanged = await readSession(baseUrl, cookie, sessionId);
  assert.equal(afterUnchanged.selectedMonitorId, "display-1");
  assert.equal(afterUnchanged.monitors.length, 1);
  assert.equal(afterUnchanged.monitors[0].id, "display-1");

  await wait(220);
  // Uma troca de monitor de verdade (o tecnico trocou de tela, ou um segundo
  // monitor foi conectado) precisa continuar sendo aplicada normalmente.
  const twoMonitors = [
    { id: "display-1", name: "Monitor 1", primary: true, width: 1920, height: 1080 },
    { id: "display-2", name: "Monitor 2", primary: false, width: 1280, height: 720 }
  ];
  const postC = await postFrame(baseUrl, {
    sessionId,
    agentSessionToken,
    enrollmentToken: enrollment.token,
    frame: "data:image/jpeg;base64,Q0ND",
    monitors: twoMonitors,
    selectedMonitorId: "display-2"
  });
  assert.equal(postC.status, 202);
  const afterChanged = await readSession(baseUrl, cookie, sessionId);
  assert.equal(afterChanged.selectedMonitorId, "display-2");
  assert.equal(afterChanged.monitors.length, 2);
});
