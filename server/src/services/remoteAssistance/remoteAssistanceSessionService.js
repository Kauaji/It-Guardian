import { getRemoteAssistanceConfig } from "../../config/environment.js";
import { withTransaction } from "../../database.js";
import { assertRemoteAssistanceEnabled, isAgentFresh, normalizeRequestedMode } from "../../domain/remoteAssistancePolicy.js";
import { hasPermission } from "../../permissions.js";
import { resolveIceServers } from "../meteredTurnService.js";
import {
  authenticateAgentToken,
  findAgentAssetByEnrollmentId,
  findAgentAssetById,
  setAgentAssetRustdeskId
} from "../../repositories/agentRepository.js";
import { addAssetHistory } from "../../repositories/assetHistoryRepository.js";
import {
  createRemoteAssistanceSession,
  endRemoteAssistanceSession,
  findOpenRemoteAssistanceSessionForAsset,
  findRemoteAssistanceSessionById,
  listRemoteAssistanceEvents,
  verifyRemoteAssistanceEventChain
} from "../../repositories/remoteAssistanceRepository.js";
import { consumeSecurityReauthentication } from "../../repositories/securityReauthenticationRepository.js";
import { findServiceOrderById } from "../../repositories/serviceOrderRepository.js";
import { clearRelay, getRelay, initializeRelay } from "../remoteAssistanceRelay.js";
import { hashSecurityToken, remoteAssistanceReauthenticationAction } from "../securityReauthenticationService.js";

import { publicError } from "../../domain/remoteAssistance/remoteAssistanceErrors.js";

import { hashToken, issueSessionToken, normalizeReason } from "../../domain/remoteAssistance/remoteAssistancePayload.js";
import { addAudit, closeAbandonedRemoteAssistanceSessions, revokeRustdeskPasswordBestEffort } from "./remoteAssistanceAudit.js";
import { assertManagedSession, assertViewerToken, safeSession } from "./remoteAssistanceGuards.js";

export async function getRemoteAssistancePublicConfig() {
  const config = getRemoteAssistanceConfig();
  const iceServers = config.webrtc.enabled ? await resolveIceServers(config) : [];
  return {
    enabled: config.enabled,
    disabledReason: config.disabledReason,
    environment: config.environment,
    captureEnabled: config.captureEnabled,
    controlEnabled: config.controlEnabled,
    consentRequired: !config.autoConsentEnabled,
    privacyModeEnabled: config.privacyModeEnabled,
    adminActionsEnabled: config.adminActionsEnabled,
    connectionMode: config.transport,
    transport: config.transport,
    transportFallback: config.transportFallback,
    targetFps: config.targetFps,
    maxFramesPerSecond: config.maxFramesPerSecond,
    maxWidth: config.maxWidth,
    maxHeight: config.maxHeight,
    jpegQuality: config.jpegQuality,
    minJpegQuality: config.minJpegQuality,
    maxJpegQuality: config.maxJpegQuality,
    adaptiveQuality: config.adaptiveQuality,
    viewerPollMs: config.viewerPollMs,
    idleTimeoutSeconds: config.idleTimeoutSeconds,
    reconnectGraceSeconds: config.reconnectGraceSeconds,
    webrtcEnabled: config.webrtc.enabled,
    iceServers,
    rustdeskEnabled: config.rustdesk.enabled,
    rustdeskPasswordTtlSeconds: config.rustdesk.passwordTtlSeconds
  };
}

/**
 * O agente relata o id RustDesk local (lido do config do cliente instalado
 * pelo coletor) igual como relata heartbeat/inventario: autenticado pelo
 * proprio token de enrollment, nunca pelo tecnico. O id nao e segredo --
 * serve so para o painel do tecnico saber com quem conectar.
 */
export async function reportAgentRustdeskId({ bearerToken, rustdeskId }) {
  const enrollment = await authenticateAgentToken(bearerToken);
  if (!enrollment) throw publicError("Token do agente invalido.", 401);
  const asset = await findAgentAssetByEnrollmentId(enrollment.id);
  if (!asset) throw publicError("Maquina do agente nao encontrada.", 404);
  const normalized = String(rustdeskId || "")
    .trim()
    .slice(0, 32);
  if (!normalized) throw publicError("Id RustDesk invalido.");
  if (normalized !== asset.rustdeskId) {
    const updated = await setAgentAssetRustdeskId({ assetId: asset.id, rustdeskId: normalized });
    await addAssetHistory({
      assetId: asset.id,
      eventType: "rustdesk_id_updated",
      message: "Id RustDesk desta maquina foi atualizado pelo agente.",
      newValue: JSON.stringify({ rustdeskId: normalized }),
      userName: "Agente IT Guardian"
    });
    return { rustdeskId: updated?.rustdeskId || normalized };
  }
  return { rustdeskId: asset.rustdeskId };
}

export async function startRemoteAssistanceSession({ user, assetId, serviceOrderId = null, requestedMode, reason, reauthenticationToken }) {
  const config = getRemoteAssistanceConfig();
  assertRemoteAssistanceEnabled(config);
  await closeAbandonedRemoteAssistanceSessions();

  const normalizedAssetId = String(assetId || "").trim();
  const normalizedServiceOrderId = String(serviceOrderId || "").trim() || null;
  const normalizedReason = normalizeReason(reason);
  const mode = normalizeRequestedMode(requestedMode, config, hasPermission(user, "remote_assistance.control"));
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

  const relay = await initializeRelay(session.id, {
    agentToken,
    viewerToken,
    quality: config.jpegQuality,
    width: config.maxWidth,
    height: config.maxHeight
  });
  return {
    session: safeSession(session, relay, config),
    viewerToken,
    // Exposto cedo (antes mesmo do consentimento) so para o frontend decidir
    // se mostra o aviso "esta maquina ainda nao relatou um id RustDesk" --
    // nao e segredo, e a senha de sessao continua so chegando depois do
    // consentimento local (issueRustdeskSessionPassword).
    rustdeskId: config.transport === "rustdesk" ? asset.rustdeskId || null : undefined
  };
}

export async function getRemoteAssistanceSession({ user, sessionId }) {
  const session = await assertManagedSession(user, sessionId);
  const relay = await getRelay(session.id);
  return safeSession(session, relay);
}

export async function getRemoteAssistanceEvents({ user, sessionId }) {
  await assertManagedSession(user, sessionId);
  return listRemoteAssistanceEvents(sessionId);
}

export async function getRemoteAssistanceEventIntegrity({ user, sessionId }) {
  await assertManagedSession(user, sessionId);
  return verifyRemoteAssistanceEventChain(sessionId);
}

export async function endRemoteAssistanceByTechnician({ user, sessionId, viewerToken }) {
  const config = getRemoteAssistanceConfig();
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
  await revokeRustdeskPasswordBestEffort(ended, config);
  await clearRelay(ended.id);
  return safeSession(ended, null);
}
