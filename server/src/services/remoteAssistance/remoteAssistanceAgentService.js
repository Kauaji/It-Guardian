import { randomBytes, randomUUID } from "node:crypto";
import { getRemoteAssistanceConfig } from "../../config/environment.js";

import {
  assertRemoteAssistanceEnabled,
  assertWebrtcEnabled,
  generateRustdeskSessionPassword,
  sanitizeSdp,
  stepAdaptiveQuality
} from "../../domain/remoteAssistancePolicy.js";

import { resolveIceServers } from "../meteredTurnService.js";
import { authenticateAgentToken, findAgentAssetByEnrollmentId } from "../../repositories/agentRepository.js";

import {
  endRemoteAssistanceSession,
  findPendingRemoteAssistanceSessionForAsset,
  setRemoteAssistanceConsent,
  touchRemoteAssistanceSession
} from "../../repositories/remoteAssistanceRepository.js";

import {
  appendRelayChatMessage,
  clearRelay,
  drainRelayCommands,
  enqueueRelayCommand,
  getRelay,
  getRelayChatMessages,
  setRelayAdaptiveQuality,
  setRelayAgentState,
  setRelayFrame,
  setRelayRustdeskCredential,
  setRelayWebrtcAnswer,
  touchRelayFrame
} from "../remoteAssistanceRelay.js";

import { publicError } from "../../domain/remoteAssistance/remoteAssistanceErrors.js";

import {
  decodeFrame,
  monitorListsEqual,
  normalizeChatMessageText,
  normalizeMonitors
} from "../../domain/remoteAssistance/remoteAssistancePayload.js";
import { addAudit, closeAbandonedRemoteAssistanceSessions, revokeRustdeskPasswordBestEffort } from "./remoteAssistanceAudit.js";
import { authenticateAgentForSession, safeSession } from "./remoteAssistanceGuards.js";

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
  const relay = await getRelay(session.id);
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
  const selected =
    normalizedMonitors.find((monitor) => monitor.id === requestedMonitor) ||
    normalizedMonitors.find((monitor) => monitor.primary) ||
    normalizedMonitors[0] ||
    null;
  const allowControl = Boolean(granted && controlAllowed && session.requestedMode === "control" && config.controlEnabled);
  await setRelayAgentState(session.id, {
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
    message: granted ? "Usuario local autorizou a assistencia remota." : "Usuario local recusou a assistencia remota.",
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
    if (config.transport === "rustdesk") {
      await issueRustdeskSessionPassword(updated, config);
    }
  }
  if (!granted) await clearRelay(updated.id);
  const relay = granted ? await getRelay(updated.id) : null;
  return { session: safeSession(updated, relay) };
}

/**
 * Gera a senha de sessao do RustDesk e a envia ao agente pela mesma fila de
 * comandos ja usada para input de mouse/teclado -- nao existe um segundo
 * canal. A senha nunca e persistida em banco (so no relay efemero) e carrega
 * seu proprio prazo de expiracao: se o comando de revogacao no encerramento
 * se perder (agente offline, rede caiu), o proprio agente aplica o TTL
 * recebido e reverte a senha local sem depender do servidor.
 */
async function issueRustdeskSessionPassword(session, config) {
  const password = generateRustdeskSessionPassword(config, (length) => randomBytes(length));
  const expiresAt = new Date(Date.now() + config.rustdesk.passwordTtlSeconds * 1000).toISOString();
  await setRelayRustdeskCredential(session.id, { password, expiresAt });
  await enqueueRelayCommand(
    session.id,
    {
      id: randomUUID(),
      type: "rustdesk_set_password",
      password,
      ttlSeconds: config.rustdesk.passwordTtlSeconds
    },
    config.maxQueuedCommands
  );
  await addAudit({
    session,
    eventType: "rustdesk_password_issued",
    message: `Senha de sessao RustDesk gerada, valida por ate ${Math.round(config.rustdesk.passwordTtlSeconds / 60)} minutos.`,
    actorType: "system",
    metadata: { ttlSeconds: config.rustdesk.passwordTtlSeconds }
  });
}

export async function receiveRemoteAssistanceFrame({
  bearerToken,
  sessionId,
  sessionToken,
  frame,
  unchanged,
  monitors,
  selectedMonitorId
}) {
  const config = getRemoteAssistanceConfig();
  assertRemoteAssistanceEnabled(config);
  const { session } = await authenticateAgentForSession({ bearerToken, sessionId, sessionToken });
  if (session.status !== "active") throw publicError("A sessao remota nao esta ativa.", 409);
  const relay = await getRelay(session.id);
  if (!relay) throw publicError("Canal efemero da sessao indisponivel.", 409);
  const minimumInterval = Math.floor(1000 / config.maxFramesPerSecond);
  if (Date.now() - relay.lastFrameAt < minimumInterval) {
    throw publicError("Taxa de quadros excedida.", 429);
  }
  const normalizedMonitors = normalizeMonitors(monitors);
  if (normalizedMonitors.length) {
    // O agente manda a lista de monitores em TODO frame (nao so quando ela
    // muda), e cada escrita de estado e um GET+SET completo do relay. Como o
    // caso comum e "nada mudou desde o ultimo frame", comparar contra o que
    // ja esta carregado evita uma ida-e-volta ao Redis por frame quando a
    // lista de monitores e o monitor selecionado continuam os mesmos.
    const resolvedSelectedMonitorId = selectedMonitorId || relay.selectedMonitorId || normalizedMonitors[0]?.id || null;
    const monitorStateChanged =
      resolvedSelectedMonitorId !== relay.selectedMonitorId || !monitorListsEqual(normalizedMonitors, relay.monitors || []);
    if (monitorStateChanged) {
      await setRelayAgentState(session.id, { monitors: normalizedMonitors, selectedMonitorId });
    }
  }
  if (unchanged === true && !frame) {
    await touchRelayFrame(session.id);
    await touchRemoteAssistanceSession(session.id);
    return { accepted: true, unchanged: true };
  }
  const decoded = decodeFrame(frame, config.maxFrameBytes);
  await setRelayFrame(session.id, decoded.dataUrl, { bytes: decoded.bytes, hash: decoded.hash });
  const nextQuality = stepAdaptiveQuality({
    quality: relay.quality,
    width: relay.width,
    height: relay.height,
    lastFrameBytes: decoded.bytes,
    config
  });
  if (nextQuality.changed) {
    await setRelayAdaptiveQuality(session.id, nextQuality);
  }
  await touchRemoteAssistanceSession(session.id);
  return { accepted: true };
}

export async function getRemoteAssistanceCommandsForAgent({ bearerToken, sessionId, sessionToken }) {
  const config = getRemoteAssistanceConfig();
  const { session } = await authenticateAgentForSession({ bearerToken, sessionId, sessionToken });
  if (session.status !== "active") return { commands: [], ended: true };
  const relay = await getRelay(session.id);
  await touchRemoteAssistanceSession(session.id);
  return {
    commands: await drainRelayCommands(session.id),
    selectedMonitorId: relay?.selectedMonitorId || session.selectedMonitorId,
    controlEnabled: Boolean(session.remoteControlEnabled),
    capturePaused: Boolean(relay?.viewerPaused),
    qualityHint: {
      width: relay?.width || config.maxWidth,
      height: relay?.height || config.maxHeight,
      jpegQuality: relay?.quality || config.jpegQuality,
      captureIntervalMs: config.agentCaptureMs
    },
    chatMessages: await getRelayChatMessages(session.id),
    // O agente so decide iniciar o processo auxiliar de WebRTC quando o
    // proprio transporte negociado for "webrtc" -- com a flag desligada ou
    // sem pedido do visualizador, o agente continua no caminho JPEG de
    // sempre, sem nenhuma mudanca de comportamento.
    transport: config.transport,
    iceServers: config.transport === "webrtc" ? await resolveIceServers(config) : [],
    ended: false
  };
}

export async function sendRemoteAssistanceChatMessageFromAgent({ bearerToken, sessionId, sessionToken, text }) {
  const config = getRemoteAssistanceConfig();
  assertRemoteAssistanceEnabled(config);
  const { session } = await authenticateAgentForSession({ bearerToken, sessionId, sessionToken });
  if (session.status !== "active") throw publicError("A sessao remota nao esta ativa.", 409);
  const message = {
    id: randomUUID(),
    sender: "agent",
    senderName: "Usuario local",
    text: normalizeChatMessageText(text),
    createdAt: new Date().toISOString()
  };
  await appendRelayChatMessage(session.id, message);
  return { message };
}

export async function getRemoteAssistanceWebrtcOfferForAgent({ bearerToken, sessionId, sessionToken }) {
  const config = getRemoteAssistanceConfig();
  assertWebrtcEnabled(config);
  const { session } = await authenticateAgentForSession({ bearerToken, sessionId, sessionToken });
  const relay = await getRelay(session.id);
  return { offer: relay?.webrtcOffer || null };
}

export async function submitRemoteAssistanceWebrtcAnswer({ bearerToken, sessionId, sessionToken, sdp }) {
  const config = getRemoteAssistanceConfig();
  assertWebrtcEnabled(config);
  const { session } = await authenticateAgentForSession({ bearerToken, sessionId, sessionToken });
  const sanitized = sanitizeSdp(sdp);
  if (!sanitized) throw publicError("Resposta SDP invalida.", 400);
  await setRelayWebrtcAnswer(session.id, sanitized);
  return { accepted: true };
}

export async function endRemoteAssistanceByAgent({ bearerToken, sessionId, sessionToken }) {
  const config = getRemoteAssistanceConfig();
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
    // O proprio agente que esta encerrando ja sabe que deve derrubar a senha
    // local (mesmo caminho de codigo do fim de TTL); isto so cobre o caso de
    // um segundo agente/instancia consultando o mesmo relay.
    await revokeRustdeskPasswordBestEffort(ended, config);
    await clearRelay(ended.id);
  }
  return { session: safeSession(ended || session, null) };
}
