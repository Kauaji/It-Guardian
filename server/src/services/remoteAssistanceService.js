import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getRemoteAssistanceConfig } from "../config/environment.js";
import { withTransaction } from "../database.js";
import {
  assertRemoteAssistanceEnabled,
  canRelayInput,
  isAgentFresh,
  normalizeRequestedMode
} from "../domain/remoteAssistancePolicy.js";
import { hasPermission } from "../permissions.js";
import {
  authenticateAgentToken,
  findAgentAssetByEnrollmentId,
  findAgentAssetById
} from "../repositories/agentRepository.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import {
  addRemoteAssistanceEvent,
  createRemoteAssistanceSession,
  endRemoteAssistanceSession,
  endRemoteAssistanceSessionsForTechnician,
  expireRemoteAssistanceSessions,
  failStaleRemoteAssistanceSessions,
  findOpenRemoteAssistanceSessionForAsset,
  findPendingRemoteAssistanceSessionForAsset,
  findRemoteAssistanceSessionById,
  listRemoteAssistanceEvents,
  setRemoteAssistanceConsent,
  setRemoteAssistanceControl,
  setRemoteAssistanceMonitor,
  touchRemoteAssistanceSession,
  validateRemoteTokenHash
} from "../repositories/remoteAssistanceRepository.js";
import { consumeSecurityReauthentication } from "../repositories/securityReauthenticationRepository.js";
import {
  addServiceOrderHistory,
  findServiceOrderById
} from "../repositories/serviceOrderRepository.js";
import {
  clearRelay,
  drainRelayCommands,
  enqueueRelayCommand,
  getRelay,
  initializeRelay,
  setRelayAgentState,
  setRelayControlEngaged,
  setRelayFrame
} from "./remoteAssistanceRelay.js";
import {
  hashSecurityToken,
  remoteAssistanceReauthenticationAction
} from "./securityReauthenticationService.js";

const allowedMouseButtons = new Set(["left", "right", "middle"]);
const allowedMouseActions = new Set(["down", "up", "click"]);
const allowedKeyActions = new Set(["down", "up", "press"]);
const namedKeys = new Set([
  "Enter", "Escape", "Backspace", "Tab", "Delete", "Insert", "Home", "End",
  "PageUp", "PageDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"
]);

function publicError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

function issueSessionToken() {
  return randomBytes(32).toString("base64url");
}

function normalizeReason(value) {
  const reason = String(value || "").trim().replace(/\s+/g, " ").slice(0, 500);
  if (reason.length < 5) {
    throw publicError("Descreva brevemente o motivo da assistencia remota.");
  }
  return reason;
}

function normalizeMonitors(monitors) {
  if (!Array.isArray(monitors)) return [];
  return monitors.slice(0, 8).map((monitor, index) => ({
    id: String(monitor?.id ?? index).trim().slice(0, 100) || String(index),
    name: String(monitor?.name || `Monitor ${index + 1}`).trim().slice(0, 100),
    primary: Boolean(monitor?.primary),
    width: Math.max(1, Math.min(16384, Number(monitor?.width) || 1)),
    height: Math.max(1, Math.min(16384, Number(monitor?.height) || 1))
  }));
}

function safeSession(session, relay = getRelay(session?.id)) {
  if (!session) return null;
  return {
    ...session,
    monitors: relay?.monitors || [],
    selectedMonitorId: relay?.selectedMonitorId || session.selectedMonitorId,
    frameReceivedAt: relay?.frameReceivedAt || null,
    hasFrame: Boolean(relay?.latestFrame),
    controlEngaged: Boolean(relay?.controlEngaged)
  };
}

function canManageSession(user, session) {
  return Boolean(
    user &&
      session &&
      (session.technicianUserId === user.id || hasPermission(user, "remote_assistance.manage"))
  );
}

async function assertManagedSession(user, sessionId) {
  await closeAbandonedRemoteAssistanceSessions();
  const session = await findRemoteAssistanceSessionById(sessionId);
  if (!session) throw publicError("Sessao de assistencia nao encontrada.", 404);
  if (!canManageSession(user, session)) {
    throw publicError("Voce nao pode acessar esta sessao de assistencia.", 403);
  }
  return session;
}

async function auditAutomaticallyClosedSessions(sessions, message, eventType = "session_failed") {
  for (const session of sessions) {
    await addAudit({
      session,
      eventType,
      message,
      actorType: "system",
      metadata: { endReason: session.endReason, status: session.status }
    });
    clearRelay(session.id);
  }
}

export async function closeAbandonedRemoteAssistanceSessions() {
  const config = getRemoteAssistanceConfig();
  const [expired, stale] = await Promise.all([
    expireRemoteAssistanceSessions(),
    failStaleRemoteAssistanceSessions(
      new Date(Date.now() - config.agentTimeoutSeconds * 1000)
    )
  ]);
  await auditAutomaticallyClosedSessions(expired, "Sessao remota expirada automaticamente.");
  await auditAutomaticallyClosedSessions(
    stale,
    "Sessao remota encerrada por perda de comunicacao com o agente."
  );
  return { expired: expired.length, stale: stale.length };
}

export async function endRemoteAssistanceSessionsOnLogout(user) {
  if (!user?.id) return 0;
  const sessions = await endRemoteAssistanceSessionsForTechnician(user.id);
  await auditAutomaticallyClosedSessions(
    sessions,
    `Assistencia remota encerrada no logout de ${user.name || "tecnico"}.`,
    "session_ended"
  );
  return sessions.length;
}

async function addAudit({
  session,
  eventType,
  message,
  actorType,
  user = null,
  metadata = {},
  db
}) {
  await addRemoteAssistanceEvent({
    sessionId: session.id,
    assetId: session.assetId,
    serviceOrderId: session.serviceOrderId,
    actorType,
    actorUserId: user?.id || null,
    actorName: user?.name || (actorType === "agent" ? "Agente IT Guardian" : null),
    eventType,
    message,
    metadata,
    db
  });
  await addAssetHistory({
    assetId: session.assetId,
    eventType: `remote_assistance_${eventType}`,
    message,
    newValue: JSON.stringify({ sessionId: session.id, ...metadata }),
    userId: user?.id || null,
    userName: user?.name || (actorType === "agent" ? "Agente IT Guardian" : null),
    db
  });
  if (session.serviceOrderId) {
    await addServiceOrderHistory({
      serviceOrderId: session.serviceOrderId,
      eventType: `remote_assistance_${eventType}`,
      message,
      newValue: JSON.stringify({ sessionId: session.id, ...metadata }),
      user,
      db
    });
  }
}

async function authenticateAgentForSession({ bearerToken, sessionId, sessionToken }) {
  const enrollment = await authenticateAgentToken(bearerToken);
  if (!enrollment) throw publicError("Token do agente invalido.", 401);
  const asset = await findAgentAssetByEnrollmentId(enrollment.id);
  if (!asset) throw publicError("Maquina do agente nao encontrada.", 404);
  const session = await findRemoteAssistanceSessionById(sessionId);
  if (!session || session.assetId !== asset.id) {
    throw publicError("Sessao de assistencia nao encontrada para esta maquina.", 404);
  }
  const validToken = await validateRemoteTokenHash({
    id: session.id,
    field: "agent_token_hash",
    tokenHash: hashToken(sessionToken)
  });
  if (!validToken) throw publicError("Token da sessao remota invalido.", 401);
  return { enrollment, asset, session };
}

async function assertViewerToken(session, viewerToken) {
  const validToken = await validateRemoteTokenHash({
    id: session.id,
    field: "viewer_token_hash",
    tokenHash: hashToken(viewerToken)
  });
  if (!validToken) throw publicError("Token de visualizacao invalido ou expirado.", 401);
}

export function getRemoteAssistancePublicConfig() {
  const config = getRemoteAssistanceConfig();
  return {
    enabled: config.enabled,
    disabledReason: config.disabledReason,
    environment: config.environment,
    captureEnabled: config.captureEnabled,
    controlEnabled: config.controlEnabled,
    consentRequired: !config.autoConsentEnabled,
    privacyModeEnabled: config.privacyModeEnabled,
    adminActionsEnabled: config.adminActionsEnabled,
    connectionMode: "snapshot_polling"
  };
}

export async function startRemoteAssistanceSession({
  user,
  assetId,
  serviceOrderId = null,
  requestedMode,
  reason,
  reauthenticationToken
}) {
  const config = getRemoteAssistanceConfig();
  assertRemoteAssistanceEnabled(config);
  await closeAbandonedRemoteAssistanceSessions();

  const normalizedAssetId = String(assetId || "").trim();
  const normalizedServiceOrderId = String(serviceOrderId || "").trim() || null;
  const normalizedReason = normalizeReason(reason);
  const mode = normalizeRequestedMode(
    requestedMode,
    config,
    hasPermission(user, "remote_assistance.control")
  );
  const asset = await findAgentAssetById(normalizedAssetId);
  if (!asset) throw publicError("Maquina monitorada nao encontrada.", 404);
  if (!isAgentFresh(asset)) {
    throw publicError("O agente desta maquina esta offline ou desatualizado.", 409);
  }

  if (normalizedServiceOrderId) {
    const serviceOrder = await findServiceOrderById(normalizedServiceOrderId, user);
    if (!serviceOrder) throw publicError("Ordem de servico nao encontrada.", 404);
    if (serviceOrder.assetId !== normalizedAssetId) {
      throw publicError("A ordem de servico nao esta vinculada a esta maquina.", 409);
    }
  }

  const existing = await findOpenRemoteAssistanceSessionForAsset(normalizedAssetId);
  if (existing) throw publicError("Esta maquina ja possui uma assistencia em andamento.", 409);

  const viewerToken = issueSessionToken();
  const agentToken = issueSessionToken();
  const expiresAt = new Date(Date.now() + config.sessionTtlMinutes * 60 * 1000);
  let session;

  await withTransaction(async (db) => {
    const consumedReauthentication = await consumeSecurityReauthentication({
      userId: user.id,
      action: remoteAssistanceReauthenticationAction,
      assetId: normalizedAssetId,
      serviceOrderId: normalizedServiceOrderId,
      tokenHash: hashSecurityToken(reauthenticationToken),
      db
    });
    if (!consumedReauthentication) {
      throw publicError("Confirme sua senha novamente antes de iniciar a assistencia.", 401);
    }

    session = await createRemoteAssistanceSession({
      assetId: normalizedAssetId,
      serviceOrderId: normalizedServiceOrderId,
      technician: user,
      reauthId: consumedReauthentication.id,
      status: "waiting_consent",
      requestedMode: mode,
      consentRequired: !config.autoConsentEnabled,
      consentStatus: config.autoConsentEnabled ? "not_required" : "pending",
      viewerTokenHash: hashToken(viewerToken),
      agentTokenHash: hashToken(agentToken),
      reason: normalizedReason,
      environment: config.environment,
      expiresAt,
      db
    });
    await addAudit({
      session,
      eventType: "session_requested",
      message: `Assistencia remota solicitada por ${user.name}.`,
      actorType: "technician",
      user,
      metadata: {
        requestedMode: mode,
        reason: normalizedReason,
        consentRequired: !config.autoConsentEnabled
      },
      db
    });
    await addAudit({
      session,
      eventType: "technician_reauthenticated",
      message: `Identidade de ${user.name} reconfirmada para esta sessao.`,
      actorType: "technician",
      user,
      metadata: { reauthenticationId: consumedReauthentication.id },
      db
    });
    if (!config.autoConsentEnabled) {
      await addAudit({
        session,
        eventType: "consent_requested",
        message: "Consentimento solicitado ao usuario local da maquina.",
        actorType: "system",
        metadata: { requestedMode: mode },
        db
      });
    }
  });

  initializeRelay(session.id, { agentToken, viewerToken });
  return { session: safeSession(session), viewerToken };
}

export async function getRemoteAssistanceSession({ user, sessionId }) {
  return safeSession(await assertManagedSession(user, sessionId));
}

export async function getRemoteAssistanceEvents({ user, sessionId }) {
  await assertManagedSession(user, sessionId);
  return listRemoteAssistanceEvents(sessionId);
}

export async function getRemoteAssistanceFrame({ user, sessionId, viewerToken }) {
  const session = await assertManagedSession(user, sessionId);
  await assertViewerToken(session, viewerToken);
  const relay = getRelay(session.id);
  return {
    frame: relay?.latestFrame || null,
    receivedAt: relay?.frameReceivedAt || null,
    selectedMonitorId: relay?.selectedMonitorId || session.selectedMonitorId
  };
}

function sanitizeInputCommand(value) {
  const type = String(value?.type || "").trim();
  if (type === "mouse_move") {
    const x = Number(value.x);
    const y = Number(value.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { type, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }
  if (type === "mouse_button") {
    const button = String(value.button || "").toLowerCase();
    const action = String(value.action || "").toLowerCase();
    if (!allowedMouseButtons.has(button) || !allowedMouseActions.has(action)) return null;
    return { type, button, action };
  }
  if (type === "mouse_wheel") {
    const delta = Number(value.delta);
    if (!Number.isFinite(delta)) return null;
    return { type, delta: Math.max(-1200, Math.min(1200, Math.trunc(delta))) };
  }
  if (type === "key") {
    const key = String(value.key || "");
    const action = String(value.action || "press").toLowerCase();
    const printable = key.length === 1 && key.charCodeAt(0) >= 0x20 && key.charCodeAt(0) <= 0x7e;
    if ((!printable && !namedKeys.has(key)) || !allowedKeyActions.has(action)) return null;
    return { type, key, action };
  }
  return null;
}

export async function sendRemoteAssistanceInput({ user, sessionId, viewerToken, command }) {
  const config = getRemoteAssistanceConfig();
  assertRemoteAssistanceEnabled(config);
  const session = await assertManagedSession(user, sessionId);
  await assertViewerToken(session, viewerToken);
  if (!canRelayInput({
    session,
    config,
    canControl: hasPermission(user, "remote_assistance.control")
  })) {
    throw publicError("O controle remoto nao esta autorizado nesta sessao.", 403);
  }
  const sanitized = sanitizeInputCommand(command);
  if (!sanitized) throw publicError("Comando de entrada nao permitido.");
  const relay = getRelay(session.id);
  if (!relay) throw publicError("Canal efemero da sessao indisponivel.", 409);
  enqueueRelayCommand(session.id, { id: randomUUID(), ...sanitized }, config.maxQueuedCommands);
  setRelayControlEngaged(session.id, true);
  return { accepted: true };
}

export async function selectRemoteAssistanceMonitor({ user, sessionId, viewerToken, monitorId }) {
  const session = await assertManagedSession(user, sessionId);
  await assertViewerToken(session, viewerToken);
  const relay = getRelay(session.id);
  const selected = relay?.monitors.find((monitor) => monitor.id === String(monitorId || ""));
  if (!selected) throw publicError("Monitor nao encontrado nesta sessao.", 404);
  relay.selectedMonitorId = selected.id;
  enqueueRelayCommand(
    session.id,
    { id: randomUUID(), type: "select_monitor", monitorId: selected.id },
    getRemoteAssistanceConfig().maxQueuedCommands
  );
  const updated = await setRemoteAssistanceMonitor(session.id, selected.id);
  if (!updated) throw publicError("A sessao remota nao esta mais ativa.", 409);
  await addAudit({
    session: updated,
    eventType: "monitor_changed",
    message: `Monitor alterado para ${selected.name}.`,
    actorType: "technician",
    user,
    metadata: { monitorId: selected.id, monitorName: selected.name }
  });
  return safeSession(updated);
}

export async function updateRemoteAssistanceControl({ user, sessionId, viewerToken, enabled }) {
  const config = getRemoteAssistanceConfig();
  const session = await assertManagedSession(user, sessionId);
  await assertViewerToken(session, viewerToken);
  if (
    enabled &&
    (session.requestedMode !== "control" ||
      session.consentStatus !== "granted" ||
      !session.controlConsentGranted ||
      !config.controlEnabled ||
      !hasPermission(user, "remote_assistance.control"))
  ) {
    throw publicError("O controle remoto nao foi autorizado.", 403);
  }
  const updated = await setRemoteAssistanceControl(session.id, Boolean(enabled));
  if (!updated) throw publicError("A sessao remota nao esta mais ativa.", 409);
  setRelayControlEngaged(session.id, Boolean(enabled));
  await addAudit({
    session: updated,
    eventType: enabled ? "control_enabled" : "control_disabled",
    message: enabled ? "Controle remoto ativado." : "Controle remoto desativado.",
    actorType: "technician",
    user,
    metadata: { enabled: Boolean(enabled) }
  });
  return safeSession(updated);
}

export async function endRemoteAssistanceByTechnician({ user, sessionId, viewerToken }) {
  const session = await assertManagedSession(user, sessionId);
  await assertViewerToken(session, viewerToken);
  const ended = await endRemoteAssistanceSession(session.id, "technician_ended");
  if (!ended) return safeSession(await findRemoteAssistanceSessionById(session.id));
  await addAudit({
    session: ended,
    eventType: "session_ended",
    message: `Assistencia remota encerrada por ${user.name}.`,
    actorType: "technician",
    user,
    metadata: { endReason: "technician_ended" }
  });
  clearRelay(ended.id);
  return safeSession(ended, null);
}

export async function getPendingRemoteAssistanceForAgent({ bearerToken }) {
  const config = getRemoteAssistanceConfig();
  if (!config.enabled) return { session: null };
  await closeAbandonedRemoteAssistanceSessions();
  const enrollment = await authenticateAgentToken(bearerToken);
  if (!enrollment) throw publicError("Token do agente invalido.", 401);
  const asset = await findAgentAssetByEnrollmentId(enrollment.id);
  if (!asset) return { session: null };
  const session = await findPendingRemoteAssistanceSessionForAsset(asset.id);
  if (!session) return { session: null };
  const relay = getRelay(session.id);
  if (!relay?.agentToken) return { session: null };
  return {
    session: {
      id: session.id,
      technicianName: session.technicianName,
      organizationName: enrollment.name || "IT Guardian",
      machineName: asset.machineAlias || asset.hostname || "Computador autorizado",
      operatingSystem: asset.operatingSystem || "Windows",
      reason: session.reason,
      requestedMode: session.requestedMode,
      consentRequired: session.consentRequired,
      autoConsent: config.autoConsentEnabled,
      expiresAt: session.expiresAt,
      serviceOrderId: session.serviceOrderId,
      sessionToken: relay.agentToken
    }
  };
}

export async function respondToRemoteAssistanceConsent({
  bearerToken,
  sessionId,
  sessionToken,
  granted,
  controlAllowed,
  monitors,
  selectedMonitorId
}) {
  const config = getRemoteAssistanceConfig();
  assertRemoteAssistanceEnabled(config);
  const { session } = await authenticateAgentForSession({ bearerToken, sessionId, sessionToken });
  const normalizedMonitors = normalizeMonitors(monitors);
  const requestedMonitor = String(selectedMonitorId || "");
  const selected = normalizedMonitors.find((monitor) => monitor.id === requestedMonitor) ||
    normalizedMonitors.find((monitor) => monitor.primary) || normalizedMonitors[0] || null;
  const allowControl = Boolean(
    granted &&
      controlAllowed &&
      session.requestedMode === "control" &&
      config.controlEnabled
  );
  setRelayAgentState(session.id, {
    monitors: normalizedMonitors,
    selectedMonitorId: selected?.id || null
  });
  const updated = await setRemoteAssistanceConsent({
    id: session.id,
    granted: Boolean(granted),
    controlAllowed: allowControl,
    selectedMonitorId: selected?.id || null,
    monitorCount: normalizedMonitors.length
  });
  if (!updated) throw publicError("A solicitacao de assistencia expirou.", 409);
  await addAudit({
    session: updated,
    eventType: granted ? "consent_granted" : "consent_denied",
    message: granted
      ? "Usuario local autorizou a assistencia remota."
      : "Usuario local recusou a assistencia remota.",
    actorType: "agent",
    metadata: {
      granted: Boolean(granted),
      controlAllowed: allowControl,
      monitorCount: normalizedMonitors.length
    }
  });
  if (granted) {
    await addAudit({
      session: updated,
      eventType: "session_started",
      message: "Assistencia remota iniciada apos consentimento local.",
      actorType: "agent",
      metadata: {
        requestedMode: session.requestedMode,
        controlAuthorized: allowControl,
        connectionMode: session.connectionMode
      }
    });
  }
  if (!granted) clearRelay(updated.id);
  return { session: safeSession(updated) };
}

function decodeFrame(dataUrl, maxFrameBytes) {
  const match = String(dataUrl || "").match(/^data:image\/jpeg;base64,([a-z0-9+/=]+)$/i);
  if (!match) throw publicError("O quadro de tela precisa ser uma imagem JPEG valida.");
  const bytes = Buffer.byteLength(match[1], "base64");
  if (!bytes || bytes > maxFrameBytes) {
    throw publicError("O quadro de tela excede o limite permitido.", 413);
  }
  return String(dataUrl);
}

export async function receiveRemoteAssistanceFrame({
  bearerToken,
  sessionId,
  sessionToken,
  frame,
  monitors,
  selectedMonitorId
}) {
  const config = getRemoteAssistanceConfig();
  assertRemoteAssistanceEnabled(config);
  const { session } = await authenticateAgentForSession({ bearerToken, sessionId, sessionToken });
  if (session.status !== "active") throw publicError("A sessao remota nao esta ativa.", 409);
  const relay = getRelay(session.id);
  if (!relay) throw publicError("Canal efemero da sessao indisponivel.", 409);
  const minimumInterval = Math.floor(1000 / config.maxFramesPerSecond);
  if (Date.now() - relay.lastFrameAt < minimumInterval) {
    throw publicError("Taxa de quadros excedida.", 429);
  }
  const normalizedMonitors = normalizeMonitors(monitors);
  if (normalizedMonitors.length) {
    setRelayAgentState(session.id, { monitors: normalizedMonitors, selectedMonitorId });
  }
  setRelayFrame(session.id, decodeFrame(frame, config.maxFrameBytes));
  await touchRemoteAssistanceSession(session.id);
  return { accepted: true };
}

export async function getRemoteAssistanceCommandsForAgent({
  bearerToken,
  sessionId,
  sessionToken
}) {
  const { session } = await authenticateAgentForSession({ bearerToken, sessionId, sessionToken });
  if (session.status !== "active") return { commands: [], ended: true };
  const relay = getRelay(session.id);
  await touchRemoteAssistanceSession(session.id);
  return {
    commands: drainRelayCommands(session.id),
    selectedMonitorId: relay?.selectedMonitorId || session.selectedMonitorId,
    controlEnabled: Boolean(session.remoteControlEnabled),
    ended: false
  };
}

export async function endRemoteAssistanceByAgent({ bearerToken, sessionId, sessionToken }) {
  const { session } = await authenticateAgentForSession({ bearerToken, sessionId, sessionToken });
  const ended = await endRemoteAssistanceSession(session.id, "local_user_ended");
  if (ended) {
    await addAudit({
      session: ended,
      eventType: "session_ended",
      message: "Assistencia remota encerrada pelo usuario local.",
      actorType: "agent",
      metadata: { endReason: "local_user_ended" }
    });
    clearRelay(ended.id);
  }
  return { session: safeSession(ended || session, null) };
}
