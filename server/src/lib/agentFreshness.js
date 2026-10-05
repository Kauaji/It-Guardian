// Mesma formula usada pelo cliente em remoteAssistanceModel.js
// (isRemoteAssistanceAssetFresh) - extraida para um util unico no
// servidor para nao existir uma terceira copia divergente quando o
// diagnostico de execucao de scripts precisou do mesmo criterio de
// "agente com contato recente".
/**
 * @param {string | Date | null | undefined} lastSeenAt Ultimo contato do agente.
 * @param {number | string | null | undefined} intervalSeconds Intervalo de coleta (padrao 300 s).
 * @param {number} [now] Relogio injetavel para testes (ms desde a epoca).
 * @returns {boolean}
 */
export function isAgentAssetFresh(lastSeenAt, intervalSeconds, now = Date.now()) {
  const lastSeenTime = Date.parse(String(lastSeenAt));
  if (!Number.isFinite(lastSeenTime)) return false;
  const effectiveInterval = Number(intervalSeconds) || 300;
  const freshnessWindow = Math.max(effectiveInterval * 3 * 1000, 10 * 60 * 1000);
  return now - lastSeenTime <= freshnessWindow;
}
