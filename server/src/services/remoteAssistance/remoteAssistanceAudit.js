import { randomUUID } from "node:crypto";
import { getRemoteAssistanceConfig } from "../../config/environment.js";

import { addAssetHistory } from "../../repositories/assetHistoryRepository.js";
import {
  addRemoteAssistanceEvent,
  endRemoteAssistanceSessionsForTechnician,
  expireRemoteAssistanceSessions,
  failStaleRemoteAssistanceSessions
} from "../../repositories/remoteAssistanceRepository.js";

import {
  addServiceOrderHistory
} from "../../repositories/serviceOrderRepository.js";
import {
  clearRelay,
  clearRelayRustdeskCredential,
  enqueueRelayCommand
} from "../remoteAssistanceRelay.js";

/**
 * Melhor esforco: pede ao agente para trocar a senha do RustDesk por uma
 * gerada localmente e nao reportada a lugar nenhum, antes de limpar o relay.
 * E "melhor esforco" porque a fila de comandos so e drenada quando a sessao
 * ainda esta ativa (ver getRemoteAssistanceCommandsForAgent) -- se o agente
 * nao chegar a fazer mais nenhum poll antes de a sessao sair de "active",
 * este comando nunca sera entregue. A garantia real de revogacao e o TTL
 * aplicado localmente pelo proprio agente (ver issueRustdeskSessionPassword),
 * nao este aviso.
 */
export async function revokeRustdeskPasswordBestEffort(session, config) {
  if (config.transport !== "rustdesk") return;
  await enqueueRelayCommand(
    session.id,
    { id: randomUUID(), type: "rustdesk_clear_password" },
    config.maxQueuedCommands
  );
  await clearRelayRustdeskCredential(session.id);
}

async function auditAutomaticallyClosedSessions(sessions, message, eventType = "session_failed") {
  const config = getRemoteAssistanceConfig();
  for (const session of sessions) {
    await addAudit({
      session,
      eventType,
      message,
      actorType: "system",
      metadata: { endReason: session.endReason, status: session.status }
    });
    await revokeRustdeskPasswordBestEffort(session, config);
    await clearRelay(session.id);
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

export async function addAudit({
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
