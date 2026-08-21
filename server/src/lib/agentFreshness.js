// Mesma formula usada pelo cliente em remoteAssistanceModel.js
// (isRemoteAssistanceAssetFresh) - extraida para um util unico no
// servidor para nao existir uma terceira copia divergente quando o
// diagnostico de execucao de scripts precisou do mesmo criterio de
// "agente com contato recente".
export function isAgentAssetFresh(lastSeenAt, intervalSeconds, now = Date.now()) {
  const lastSeenTime = Date.parse(lastSeenAt);
  if (!Number.isFinite(lastSeenTime)) return false;
  const effectiveInterval = Number(intervalSeconds) || 300;
  const freshnessWindow = Math.max(effectiveInterval * 3 * 1000, 10 * 60 * 1000);
  return now - lastSeenTime <= freshnessWindow;
}
