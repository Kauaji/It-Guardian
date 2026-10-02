/**
 * Presenca do agente: decide quando um heartbeat representa o primeiro
 * registro ou a volta de uma maquina que ficou em silencio, e descreve o
 * evento para o historico do ativo. Nenhuma funcao acessa banco.
 */

/** Limite de silencio, em segundos, configurado por ambiente (padrao 10 minutos). */
export function resolveOfflineThresholdSeconds(env = process.env) {
  return env.AGENT_OFFLINE_AFTER_SECONDS
    ? Number(env.AGENT_OFFLINE_AFTER_SECONDS)
    : Number(env.AGENT_OFFLINE_AFTER_MINUTES || 10) * 60;
}

/**
 * A maquina ficou em silencio por mais que o maior entre o limite configurado e
 * tres vezes o intervalo de heartbeat (o anterior, ou o do payload recebido).
 */
export function wasAgentStale({ previous, payloadIntervalSeconds, configuredThresholdSeconds, now = Date.now() }) {
  if (!previous) return false;
  const staleThresholdMs = Math.max(
    configuredThresholdSeconds,
    Number(previous.intervalSeconds || payloadIntervalSeconds) * 3
  ) * 1000;
  return now - new Date(previous.lastSeenAt).getTime() > staleThresholdMs;
}

/**
 * Evento de historico do ativo para este heartbeat: "agent_enrolled" na
 * primeira vez, "agent_reconnected" apos inatividade e null caso contrario.
 */
export function resolveAgentConnectionEvent({ previous, payload, enrollmentId, env = process.env, now = Date.now() }) {
  const stale = wasAgentStale({
    previous,
    payloadIntervalSeconds: payload.intervalSeconds,
    configuredThresholdSeconds: resolveOfflineThresholdSeconds(env),
    now
  });
  if (previous && !stale) return null;

  return {
    eventType: previous ? "agent_reconnected" : "agent_enrolled",
    message: previous
      ? `Agente IT Guardian voltou a comunicar na maquina ${payload.hostname}.`
      : `Agente IT Guardian registrado na maquina ${payload.hostname}.`,
    newValue: JSON.stringify({
      agentVersion: payload.agentVersion,
      source: "agent",
      enrollmentId
    })
  };
}
