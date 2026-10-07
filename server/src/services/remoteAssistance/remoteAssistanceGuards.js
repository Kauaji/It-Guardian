import { getRemoteAssistanceConfig } from "../../config/environment.js";

import { deriveConnectionState } from "../../domain/remoteAssistancePolicy.js";

import { authenticateAgentToken, findAgentAssetByEnrollmentId } from "../../repositories/agentRepository.js";

import { findRemoteAssistanceSessionById, validateRemoteTokenHash } from "../../repositories/remoteAssistanceRepository.js";

import { computeRelayMetrics } from "../remoteAssistanceRelay.js";

import { publicError } from "../../domain/remoteAssistance/remoteAssistanceErrors.js";

import { canManageSession, hashToken } from "../../domain/remoteAssistance/remoteAssistancePayload.js";
import { closeAbandonedRemoteAssistanceSessions } from "./remoteAssistanceAudit.js";

export function safeSession(session, relay = null, config = getRemoteAssistanceConfig()) {
  if (!session) return null;
  const metrics = computeRelayMetrics(relay);
  return {
    ...session,
    monitors: relay?.monitors || [],
    selectedMonitorId: relay?.selectedMonitorId || session.selectedMonitorId,
    frameReceivedAt: relay?.frameReceivedAt || null,
    hasFrame: Boolean(relay?.latestFrameHash),
    controlEngaged: Boolean(relay?.controlEngaged),
    connectionState: deriveConnectionState({ session, relay, config }),
    transport: config.transport,
    paused: Boolean(relay?.viewerPaused),
    metrics: metrics
      ? {
          fps: metrics.fps,
          bytesPerSecond: metrics.bytesPerSecond,
          lastFrameBytes: metrics.lastFrameBytes,
          frameAgeMs: metrics.frameAgeMs,
          quality: metrics.quality,
          width: metrics.width,
          height: metrics.height
        }
      : null
  };
}

export async function assertManagedSession(user, sessionId) {
  await closeAbandonedRemoteAssistanceSessions();
  const session = await findRemoteAssistanceSessionById(sessionId);
  if (!session) throw publicError("Sessao de assistencia nao encontrada.", 404);
  if (!canManageSession(user, session)) {
    throw publicError("Voce nao pode acessar esta sessao de assistencia.", 403);
  }
  return session;
}

export async function authenticateAgentForSession({ bearerToken, sessionId, sessionToken }) {
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

export async function assertViewerToken(session, viewerToken) {
  const validToken = await validateRemoteTokenHash({
    id: session.id,
    field: "viewer_token_hash",
    tokenHash: hashToken(viewerToken)
  });
  if (!validToken) throw publicError("Token de visualizacao invalido ou expirado.", 401);
}
