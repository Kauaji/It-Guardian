import { randomUUID } from "node:crypto";
import { getRemoteAssistanceConfig } from "../../config/environment.js";

import {
  assertRemoteAssistanceEnabled,
  assertRustdeskEnabled,
  assertWebrtcEnabled,
  canRelayInput,
  deriveConnectionState,
  isSessionActive,
  sanitizeSdp
} from "../../domain/remoteAssistancePolicy.js";
import { hasPermission } from "../../permissions.js";

import {
  findAgentAssetById
} from "../../repositories/agentRepository.js";

import {
  setRemoteAssistanceControl,
  setRemoteAssistanceMonitor
} from "../../repositories/remoteAssistanceRepository.js";

import {
  appendRelayChatMessage,
  computeRelayMetrics,
  consumeRelayRustdeskCredential,
  enqueueRelayCommand,
  getRelay,
  getRelayChatMessages,
  getRelayFrame,
  setRelayAgentState,
  setRelayControlEngaged,
  setRelayViewerPaused,
  setRelayWebrtcOffer
} from "../remoteAssistanceRelay.js";

import { publicError } from "../../domain/remoteAssistance/remoteAssistanceErrors.js";
import { sanitizeInputCommand } from "../../domain/remoteAssistance/remoteAssistanceInput.js";
import {
  normalizeChatMessageText
} from "../../domain/remoteAssistance/remoteAssistancePayload.js";
import { addAudit } from "./remoteAssistanceAudit.js";
import {
  assertManagedSession,
  assertViewerToken,
  safeSession
} from "./remoteAssistanceGuards.js";

export async function getRemoteAssistanceFrame({ user, sessionId, viewerToken }) {
  const config = getRemoteAssistanceConfig();
  const session = await assertManagedSession(user, sessionId);
  await assertViewerToken(session, viewerToken);
  const [relay, frame] = await Promise.all([getRelay(session.id), getRelayFrame(session.id)]);
  const metrics = computeRelayMetrics(relay);
  return {
    frame: frame || null,
    receivedAt: relay?.frameReceivedAt || null,
    selectedMonitorId: relay?.selectedMonitorId || session.selectedMonitorId,
    connectionState: deriveConnectionState({ session, relay, config }),
    transport: config.transport,
    paused: Boolean(relay?.viewerPaused),
    metrics,
    chatMessages: await getRelayChatMessages(session.id)
  };
}

export async function sendRemoteAssistanceChatMessage({ user, sessionId, viewerToken, text }) {
  const config = getRemoteAssistanceConfig();
  assertRemoteAssistanceEnabled(config);
  const session = await assertManagedSession(user, sessionId);
  await assertViewerToken(session, viewerToken);
  if (!isSessionActive(session.status)) {
    throw publicError("A sessao remota nao esta mais ativa.", 409);
  }
  const message = {
    id: randomUUID(),
    sender: "technician",
    senderName: user.name || "Tecnico",
    text: normalizeChatMessageText(text),
    createdAt: new Date().toISOString()
  };
  await appendRelayChatMessage(session.id, message);
  return { message };
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
  const relay = await getRelay(session.id);
  if (!relay) throw publicError("Canal efemero da sessao indisponivel.", 409);
  await enqueueRelayCommand(session.id, { id: randomUUID(), ...sanitized }, config.maxQueuedCommands);
  await setRelayControlEngaged(session.id, true);
  return { accepted: true };
}

export async function selectRemoteAssistanceMonitor({ user, sessionId, viewerToken, monitorId }) {
  const session = await assertManagedSession(user, sessionId);
  await assertViewerToken(session, viewerToken);
  const relay = await getRelay(session.id);
  const selected = relay?.monitors.find((monitor) => monitor.id === String(monitorId || ""));
  if (!selected) throw publicError("Monitor nao encontrado nesta sessao.", 404);
  const updatedRelay = await setRelayAgentState(session.id, {
    monitors: relay.monitors,
    selectedMonitorId: selected.id
  });
  await enqueueRelayCommand(
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
  return safeSession(updated, updatedRelay);
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
  const relay = await setRelayControlEngaged(session.id, Boolean(enabled));
  await addAudit({
    session: updated,
    eventType: enabled ? "control_enabled" : "control_disabled",
    message: enabled ? "Controle remoto ativado." : "Controle remoto desativado.",
    actorType: "technician",
    user,
    metadata: { enabled: Boolean(enabled) }
  });
  return safeSession(updated, relay);
}

/**
 * Revela a credencial RustDesk da sessao ativa ao tecnico responsavel: id do
 * dispositivo (do card da maquina) + senha de sessao (do relay efemero,
 * nunca do banco). Cada chamada fica registrada na auditoria -- diferente do
 * frame/comandos do snapshot polling, aqui o IT Guardian perde visibilidade
 * do que acontece depois que o tecnico abre o cliente RustDesk nativo, entao
 * saber quem pediu a credencial e quando e o unico rastro que sobra deste
 * ponto em diante.
 */
export async function getRemoteAssistanceRustdeskCredentials({ user, sessionId, viewerToken }) {
  const config = getRemoteAssistanceConfig();
  assertRustdeskEnabled(config);
  const session = await assertManagedSession(user, sessionId);
  await assertViewerToken(session, viewerToken);
  if (!isSessionActive(session.status)) {
    throw publicError("A sessao remota nao esta mais ativa.", 409);
  }
  const asset = await findAgentAssetById(session.assetId);
  if (!asset?.rustdeskId) {
    throw publicError("Esta maquina ainda nao relatou um id RustDesk.", 409);
  }
  const relay = await getRelay(session.id);
  if (!relay?.rustdeskPassword || !relay.rustdeskPasswordExpiresAt) {
    throw publicError("A senha desta sessao ainda nao foi emitida pelo agente.", 409);
  }
  if (new Date(relay.rustdeskPasswordExpiresAt).getTime() <= Date.now()) {
    throw publicError("A senha desta sessao expirou. Peca ao usuario para autorizar novamente.", 409);
  }
  await consumeRelayRustdeskCredential(session.id);
  await addAudit({
    session,
    eventType: "rustdesk_credentials_revealed",
    message: `${user.name} visualizou a credencial de conexao RustDesk desta sessao.`,
    actorType: "technician",
    user,
    metadata: { revealCount: (relay.rustdeskPasswordRevealCount || 0) + 1 }
  });
  return {
    rustdeskId: asset.rustdeskId,
    password: relay.rustdeskPassword,
    expiresAt: relay.rustdeskPasswordExpiresAt
  };
}

export async function updateRemoteAssistanceCapture({ user, sessionId, viewerToken, paused }) {
  const session = await assertManagedSession(user, sessionId);
  await assertViewerToken(session, viewerToken);
  if (!isSessionActive(session.status)) {
    throw publicError("A sessao remota nao esta mais ativa.", 409);
  }
  const relay = await setRelayViewerPaused(session.id, Boolean(paused));
  await addAudit({
    session,
    eventType: paused ? "viewer_paused" : "viewer_resumed",
    message: paused ? "Tecnico pausou a visualizacao remota." : "Tecnico retomou a visualizacao remota.",
    actorType: "technician",
    user,
    metadata: { paused: Boolean(paused) }
  });
  return safeSession(session, relay);
}

// --- Sinalizacao WebRTC (contrato preparado, inativo enquanto a flag estiver
// desligada). Nenhum viewer ou agente real negocia por este caminho ainda:
// existe para uma futura evolucao do transporte sem redesenhar a API.

export async function submitRemoteAssistanceWebrtcOffer({ user, sessionId, viewerToken, sdp }) {
  const config = getRemoteAssistanceConfig();
  assertWebrtcEnabled(config);
  const session = await assertManagedSession(user, sessionId);
  await assertViewerToken(session, viewerToken);
  if (!isSessionActive(session.status)) {
    throw publicError("A sessao remota nao esta mais ativa.", 409);
  }
  const sanitized = sanitizeSdp(sdp);
  if (!sanitized) throw publicError("Oferta SDP invalida.", 400);
  await setRelayWebrtcOffer(session.id, sanitized);
  return { accepted: true };
}

export async function getRemoteAssistanceWebrtcAnswer({ user, sessionId, viewerToken }) {
  const config = getRemoteAssistanceConfig();
  assertWebrtcEnabled(config);
  const session = await assertManagedSession(user, sessionId);
  await assertViewerToken(session, viewerToken);
  const relay = await getRelay(session.id);
  return { answer: relay?.webrtcAnswer || null };
}
