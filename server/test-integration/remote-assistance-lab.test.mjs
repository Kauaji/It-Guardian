import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "remote-assistance-integration-secret-32-chars";
process.env.NODE_ENV = "test";
process.env.ENABLE_REMOTE_ASSISTANCE = "true";
process.env.REMOTE_ASSISTANCE_ENV = "lab";
process.env.ENABLE_REMOTE_CAPTURE = "true";
process.env.ENABLE_REMOTE_CONTROL = "true";
process.env.REMOTE_ASSISTANCE_LAB_AUTO_CONSENT = "false";
process.env.ENABLE_REMOTE_PRIVACY_MODE = "false";
process.env.ENABLE_REMOTE_ADMIN_ACTIONS = "false";
process.env.REMOTE_ASSISTANCE_MAX_FPS = "1";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");

const trustedOrigin = "http://localhost:5173";
const machineId = "remote-assistance-lab-machine";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function heartbeatPayload(overrides = {}) {
  return {
    machineId,
    hostname: "LAB-REMOTE-01",
    machineAlias: "Notebook do laboratorio",
    operatingSystem: "Microsoft Windows 11 Pro",
    osArchitecture: "64-bit",
    windowsVersion: "23H2",
    localIp: "192.168.50.20",
    macAddress: "00-11-22-33-44-66",
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
    inventoryDetails: { cpuCores: 8, software: [] },
    ...overrides
  };
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

function browserHeaders(cookie, extra = {}) {
  return {
    "content-type": "application/json",
    cookie,
    origin: trustedOrigin,
    ...extra
  };
}

async function heartbeat(baseUrl, enrollmentToken, overrides = {}) {
  const response = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollmentToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(heartbeatPayload(overrides))
  });
  assert.equal(response.status, 202);
  return response.json();
}

async function reauthenticate(baseUrl, cookie, serviceOrderId = null, password = "123456") {
  return fetch(`${baseUrl}/api/security/reauthenticate`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({
      password,
      action: "remote_assistance_start",
      assetId: machineId,
      serviceOrderId
    })
  });
}

async function startSession(baseUrl, cookie, {
  token,
  mode = "view",
  serviceOrderId = null,
  reason = "Atendimento remoto autorizado em laboratorio"
} = {}) {
  return fetch(`${baseUrl}/api/remote-assistance/assets/${machineId}/sessions`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({
      reauthenticationToken: token,
      requestedMode: mode,
      reason,
      serviceOrderId
    })
  });
}

async function pendingSession(baseUrl, enrollmentToken) {
  const response = await fetch(`${baseUrl}/api/agents/remote-assistance/pending`, {
    headers: { authorization: `Bearer ${enrollmentToken}` }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  return (await response.json()).session;
}

async function consent(baseUrl, enrollmentToken, session, granted, controlAllowed = false) {
  const response = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${session.id}/consent`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${enrollmentToken}`,
        "x-remote-session-token": session.sessionToken,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        granted,
        controlAllowed,
        monitors: [
          { id: "display-1", name: "Tela principal", primary: true, width: 1920, height: 1080 },
          { id: "display-2", name: "Tela secundaria", primary: false, width: 1280, height: 1024 }
        ],
        selectedMonitorId: "display-1"
      })
    }
  );
  assert.equal(response.status, 200);
  return (await response.json()).session;
}

test("assistencia remota exige autorizacao, consentimento e mantem frames efemeros", async (t) => {
  await initializeRuntime();
  const enrollment = await createAgentEnrollment({ name: "Laboratorio remoto" });
  const server = await listen(createApp());
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await closeDatabase();
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  await heartbeat(baseUrl, enrollment.token);
  const adminCookie = await login(baseUrl);
  const restrictedCookie = await login(baseUrl, "sem.permissao@itguardian.local");

  const restrictedConfig = await fetch(`${baseUrl}/api/remote-assistance/config`, {
    headers: { cookie: restrictedCookie }
  });
  assert.equal(restrictedConfig.status, 403);

  const configResponse = await fetch(`${baseUrl}/api/remote-assistance/config`, {
    headers: { cookie: adminCookie }
  });
  assert.equal(configResponse.status, 200);
  assert.equal(configResponse.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.deepEqual(await configResponse.json(), {
    enabled: true,
    disabledReason: null,
    environment: "lab",
    captureEnabled: true,
    controlEnabled: true,
    consentRequired: true,
    privacyModeEnabled: false,
    adminActionsEnabled: false,
    connectionMode: "snapshot_polling",
    transport: "snapshot_polling",
    transportFallback: false,
    targetFps: 1,
    maxFramesPerSecond: 1,
    maxWidth: 1280,
    maxHeight: 720,
    jpegQuality: 65,
    minJpegQuality: 35,
    maxJpegQuality: 80,
    adaptiveQuality: true,
    viewerPollMs: 1000,
    idleTimeoutSeconds: 40,
    reconnectGraceSeconds: 30,
    webrtcEnabled: false,
    iceServers: []
  });

  const orderResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(adminCookie),
    body: JSON.stringify({ title: "Atendimento remoto de laboratorio" })
  });
  assert.equal(orderResponse.status, 201);
  const serviceOrderId = (await orderResponse.json()).serviceOrder.id;
  const linkResponse = await fetch(`${baseUrl}/api/service-orders/${serviceOrderId}/asset`, {
    method: "PATCH",
    headers: browserHeaders(adminCookie),
    body: JSON.stringify({ assetId: machineId })
  });
  assert.equal(linkResponse.status, 200);

  process.env.ENABLE_REMOTE_CONTROL = "false";
  const disabledControl = await startSession(baseUrl, adminCookie, {
    token: "unused",
    mode: "control",
    serviceOrderId
  });
  assert.equal(disabledControl.status, 403);
  process.env.ENABLE_REMOTE_CONTROL = "true";

  const noReauthentication = await startSession(baseUrl, adminCookie, {
    mode: "view",
    serviceOrderId
  });
  assert.equal(noReauthentication.status, 401);

  const badReauthentication = await reauthenticate(
    baseUrl,
    adminCookie,
    serviceOrderId,
    "senha-incorreta"
  );
  assert.equal(badReauthentication.status, 401);

  const reauthenticationResponse = await reauthenticate(baseUrl, adminCookie, serviceOrderId);
  assert.equal(reauthenticationResponse.status, 200);
  const reauthentication = await reauthenticationResponse.json();
  const reauthenticationLifetime = new Date(reauthentication.expiresAt).getTime() - Date.now();
  assert.ok(reauthenticationLifetime > 4 * 60 * 1000);
  assert.ok(reauthenticationLifetime <= 5 * 60 * 1000 + 5000);

  const startedResponse = await startSession(baseUrl, adminCookie, {
    token: reauthentication.token,
    mode: "control",
    serviceOrderId
  });
  assert.equal(startedResponse.status, 201);
  const started = await startedResponse.json();
  assert.equal(started.session.status, "waiting_consent");
  assert.equal(started.session.consentStatus, "pending");

  const duplicateResponse = await startSession(baseUrl, adminCookie, {
    token: "not-consumed",
    serviceOrderId
  });
  assert.equal(duplicateResponse.status, 409);

  const agentPending = await pendingSession(baseUrl, enrollment.token);
  assert.equal(agentPending.id, started.session.id);
  assert.equal(agentPending.autoConsent, false);
  assert.equal(agentPending.machineName, "Notebook do laboratorio");
  const active = await consent(baseUrl, enrollment.token, agentPending, true, true);
  assert.equal(active.status, "active");
  assert.equal(active.controlConsentGranted, true);
  assert.equal(active.monitors.length, 2);

  const monitorResponse = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/monitor`,
    {
      method: "POST",
      headers: browserHeaders(adminCookie, { "x-remote-viewer-token": started.viewerToken }),
      body: JSON.stringify({ monitorId: "display-2" })
    }
  );
  assert.equal(monitorResponse.status, 200);
  assert.equal((await monitorResponse.json()).session.selectedMonitorId, "display-2");

  const controlResponse = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/control`,
    {
      method: "POST",
      headers: browserHeaders(adminCookie, { "x-remote-viewer-token": started.viewerToken }),
      body: JSON.stringify({ enabled: true })
    }
  );
  assert.equal(controlResponse.status, 200);
  assert.equal((await controlResponse.json()).session.remoteControlEnabled, true);

  const inputResponse = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/input`,
    {
      method: "POST",
      headers: browserHeaders(adminCookie, { "x-remote-viewer-token": started.viewerToken }),
      body: JSON.stringify({ type: "mouse_move", x: 0.25, y: 0.75 })
    }
  );
  assert.equal(inputResponse.status, 202);

  const invalidInput = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/input`,
    {
      method: "POST",
      headers: browserHeaders(adminCookie, { "x-remote-viewer-token": started.viewerToken }),
      body: JSON.stringify({ type: "key", key: "Control+Alt+Delete", action: "press" })
    }
  );
  assert.equal(invalidInput.status, 400);

  const lockKeyboardResponse = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/input`,
    {
      method: "POST",
      headers: browserHeaders(adminCookie, { "x-remote-viewer-token": started.viewerToken }),
      body: JSON.stringify({ type: "block_input", enabled: true })
    }
  );
  assert.equal(lockKeyboardResponse.status, 202);

  const commandsResponse = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${active.id}/commands`,
    {
      headers: {
        authorization: `Bearer ${enrollment.token}`,
        "x-remote-session-token": agentPending.sessionToken
      }
    }
  );
  assert.equal(commandsResponse.status, 200);
  const commands = await commandsResponse.json();
  assert.equal(commands.controlEnabled, true);
  assert.equal(commands.capturePaused, false);
  assert.equal(commands.qualityHint.width, 1280);
  assert.equal(commands.qualityHint.height, 720);
  assert.equal(commands.qualityHint.jpegQuality, 65);
  assert.ok(commands.qualityHint.captureIntervalMs >= 1000);
  assert.ok(commands.commands.some((command) => command.type === "select_monitor"));
  assert.ok(commands.commands.some((command) => command.type === "mouse_move"));
  assert.ok(commands.commands.some((command) => command.type === "block_input" && command.enabled === true));
  assert.equal(commands.transport, "snapshot_polling");
  assert.deepEqual(commands.iceServers, []);

  const frame = "data:image/jpeg;base64,/9j/2Q==";
  const frameResponse = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${active.id}/frame`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${enrollment.token}`,
        "x-remote-session-token": agentPending.sessionToken,
        "content-type": "application/json"
      },
      body: JSON.stringify({ frame, selectedMonitorId: "display-2" })
    }
  );
  assert.equal(frameResponse.status, 202);

  const excessiveFrame = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${active.id}/frame`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${enrollment.token}`,
        "x-remote-session-token": agentPending.sessionToken,
        "content-type": "application/json"
      },
      body: JSON.stringify({ frame })
    }
  );
  assert.equal(excessiveFrame.status, 429);

  const viewerFrame = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/frame`,
    {
      headers: {
        cookie: adminCookie,
        "x-remote-viewer-token": started.viewerToken
      }
    }
  );
  assert.equal(viewerFrame.status, 200);
  assert.equal(viewerFrame.headers.get("cache-control"), "private, no-store, max-age=0");
  const viewerFrameBody = await viewerFrame.json();
  assert.equal(viewerFrameBody.frame, frame);
  assert.equal(viewerFrameBody.connectionState, "active");
  assert.equal(viewerFrameBody.transport, "snapshot_polling");
  assert.equal(viewerFrameBody.paused, false);
  assert.equal(viewerFrameBody.metrics.framesTotal, 1);
  assert.ok(viewerFrameBody.metrics.lastFrameBytes > 0);
  assert.equal(viewerFrameBody.metrics.duplicateFramesSkipped, 0);

  const chatFromTechnician = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/chat`,
    {
      method: "POST",
      headers: browserHeaders(adminCookie, { "x-remote-viewer-token": started.viewerToken }),
      body: JSON.stringify({ text: "  Ola, pode descrever o problema? IT-GUARDIAN-CHAT-MARKER  " })
    }
  );
  assert.equal(chatFromTechnician.status, 201);
  const technicianMessage = (await chatFromTechnician.json()).message;
  assert.equal(technicianMessage.sender, "technician");
  assert.equal(technicianMessage.text, "Ola, pode descrever o problema? IT-GUARDIAN-CHAT-MARKER");

  const emptyChat = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/chat`,
    {
      method: "POST",
      headers: browserHeaders(adminCookie, { "x-remote-viewer-token": started.viewerToken }),
      body: JSON.stringify({ text: "   " })
    }
  );
  assert.equal(emptyChat.status, 400);

  const chatFromAgent = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${active.id}/chat`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${enrollment.token}`,
        "x-remote-session-token": agentPending.sessionToken,
        "content-type": "application/json"
      },
      body: JSON.stringify({ text: "A impressora nao liga" })
    }
  );
  assert.equal(chatFromAgent.status, 201);
  const agentMessage = (await chatFromAgent.json()).message;
  assert.equal(agentMessage.sender, "agent");

  const commandsWithChat = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${active.id}/commands`,
    {
      headers: {
        authorization: `Bearer ${enrollment.token}`,
        "x-remote-session-token": agentPending.sessionToken
      }
    }
  );
  const commandsWithChatBody = await commandsWithChat.json();
  assert.deepEqual(
    commandsWithChatBody.chatMessages.map((message) => message.id),
    [technicianMessage.id, agentMessage.id]
  );

  const viewerFrameWithChat = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/frame`,
    { headers: { cookie: adminCookie, "x-remote-viewer-token": started.viewerToken } }
  );
  const viewerFrameWithChatBody = await viewerFrameWithChat.json();
  assert.deepEqual(
    viewerFrameWithChatBody.chatMessages.map((message) => message.id),
    [technicianMessage.id, agentMessage.id]
  );

  const pauseResponse = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/pause`,
    {
      method: "POST",
      headers: browserHeaders(adminCookie, { "x-remote-viewer-token": started.viewerToken }),
      body: JSON.stringify({ paused: true })
    }
  );
  assert.equal(pauseResponse.status, 200);
  assert.equal((await pauseResponse.json()).session.paused, true);

  const commandsWhilePaused = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${active.id}/commands`,
    {
      headers: {
        authorization: `Bearer ${enrollment.token}`,
        "x-remote-session-token": agentPending.sessionToken
      }
    }
  );
  assert.equal((await commandsWhilePaused.json()).capturePaused, true);

  const resumeResponse = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/pause`,
    {
      method: "POST",
      headers: browserHeaders(adminCookie, { "x-remote-viewer-token": started.viewerToken }),
      body: JSON.stringify({ paused: false })
    }
  );
  assert.equal(resumeResponse.status, 200);
  assert.equal((await resumeResponse.json()).session.paused, false);

  await new Promise((resolve) => setTimeout(resolve, 1100));
  const unchangedPing = await fetch(
    `${baseUrl}/api/agents/remote-assistance/sessions/${active.id}/frame`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${enrollment.token}`,
        "x-remote-session-token": agentPending.sessionToken,
        "content-type": "application/json"
      },
      body: JSON.stringify({ unchanged: true })
    }
  );
  assert.equal(unchangedPing.status, 202);
  assert.equal((await unchangedPing.json()).unchanged, true);
  const viewerFrameAfterUnchanged = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/frame`,
    { headers: { cookie: adminCookie, "x-remote-viewer-token": started.viewerToken } }
  );
  const unchangedBody = await viewerFrameAfterUnchanged.json();
  assert.equal(unchangedBody.frame, frame);
  assert.equal(unchangedBody.metrics.framesTotal, 1);
  assert.equal(unchangedBody.metrics.unchangedPings, 1);
  assert.ok(unchangedBody.metrics.frameAgeMs < 1000);

  const eventsResponse = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/events`,
    { headers: { cookie: adminCookie } }
  );
  assert.equal(eventsResponse.status, 200);
  const eventTypes = (await eventsResponse.json()).events.map((event) => event.eventType);
  for (const expected of [
    "session_requested",
    "technician_reauthenticated",
    "consent_requested",
    "consent_granted",
    "session_started",
    "monitor_changed",
    "control_enabled"
  ]) {
    assert.ok(eventTypes.includes(expected), `evento ausente: ${expected}`);
  }

  const persistedBeforeEnd = await Promise.all([
    query("SELECT * FROM remote_assistance_sessions WHERE id = $1", [active.id]),
    query("SELECT * FROM remote_assistance_events WHERE session_id = $1", [active.id]),
    query("SELECT * FROM asset_history WHERE asset_id = $1 AND event_type LIKE 'remote_assistance_%'", [machineId]),
    query("SELECT * FROM service_order_history WHERE service_order_id = $1 AND event_type LIKE 'remote_assistance_%'", [serviceOrderId])
  ]);
  assert.equal(persistedBeforeEnd[0].rowCount, 1);
  assert.ok(persistedBeforeEnd[1].rowCount >= 7);
  assert.ok(persistedBeforeEnd[2].rowCount >= 7);
  assert.ok(persistedBeforeEnd[3].rowCount >= 7);
  assert.doesNotMatch(JSON.stringify(persistedBeforeEnd), /data:image\/jpeg/i);
  assert.doesNotMatch(JSON.stringify(persistedBeforeEnd), /IT-GUARDIAN-CHAT-MARKER/);

  const endResponse = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${active.id}/end`,
    {
      method: "POST",
      headers: browserHeaders(adminCookie, { "x-remote-viewer-token": started.viewerToken }),
      body: "{}"
    }
  );
  assert.equal(endResponse.status, 200);
  assert.equal((await endResponse.json()).session.status, "ended");

  const deniedReauthentication = await reauthenticate(baseUrl, adminCookie);
  assert.equal(deniedReauthentication.status, 200);
  const deniedStart = await startSession(baseUrl, adminCookie, {
    token: (await deniedReauthentication.json()).token,
    mode: "view"
  });
  assert.equal(deniedStart.status, 201);
  const deniedStarted = await deniedStart.json();
  const deniedPending = await pendingSession(baseUrl, enrollment.token);
  const denied = await consent(baseUrl, enrollment.token, deniedPending, false, false);
  assert.equal(denied.status, "consent_denied");
  assert.equal(denied.consentStatus, "denied");
  assert.equal(deniedStarted.session.id, denied.id);

  const reusableReauthentication = await reauthenticate(baseUrl, adminCookie);
  assert.equal(reusableReauthentication.status, 200);
  const reusableToken = (await reusableReauthentication.json()).token;
  await query("UPDATE agent_assets SET last_seen_at = $2 WHERE asset_id = $1", [
    machineId,
    new Date(Date.now() - 2 * 60 * 60 * 1000)
  ]);
  const staleStart = await startSession(baseUrl, adminCookie, { token: reusableToken });
  assert.equal(staleStart.status, 409);
  await heartbeat(baseUrl, enrollment.token);

  const expiringStart = await startSession(baseUrl, adminCookie, { token: reusableToken });
  assert.equal(expiringStart.status, 201);
  const expiring = await expiringStart.json();
  await query("UPDATE remote_assistance_sessions SET expires_at = $2 WHERE id = $1", [
    expiring.session.id,
    new Date(Date.now() - 1000)
  ]);
  const expiredResponse = await fetch(
    `${baseUrl}/api/remote-assistance/sessions/${expiring.session.id}`,
    { headers: { cookie: adminCookie } }
  );
  assert.equal(expiredResponse.status, 200);
  assert.equal((await expiredResponse.json()).session.status, "expired");

  const logoutReauthentication = await reauthenticate(baseUrl, adminCookie);
  assert.equal(logoutReauthentication.status, 200);
  const logoutStart = await startSession(baseUrl, adminCookie, {
    token: (await logoutReauthentication.json()).token,
    mode: "view"
  });
  assert.equal(logoutStart.status, 201);
  const logoutSession = await logoutStart.json();
  const logoutPending = await pendingSession(baseUrl, enrollment.token);
  await consent(baseUrl, enrollment.token, logoutPending, true, false);
  const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: browserHeaders(adminCookie),
    body: "{}"
  });
  assert.equal(logoutResponse.status, 204);
  const loggedOutSession = await query(
    "SELECT status, end_reason FROM remote_assistance_sessions WHERE id = $1",
    [logoutSession.session.id]
  );
  assert.equal(loggedOutSession.rows[0].status, "ended");
  assert.equal(loggedOutSession.rows[0].end_reason, "technician_logout");
});
