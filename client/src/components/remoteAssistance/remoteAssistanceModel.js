const terminalStatuses = new Set(["consent_denied", "ended", "failed", "expired"]);

export function isRemoteAssistanceFrontendEnabled(env = import.meta.env) {
  return env?.VITE_ENABLE_REMOTE_ASSISTANCE === "true";
}

export function canShowRemoteAssistanceAction({
  frontendEnabled,
  canView,
  canStart,
  eligible,
  backendEnabled
}) {
  return Boolean(frontendEnabled && canView && canStart && eligible && backendEnabled);
}

export function getRemoteAssetLastSeenAt(asset) {
  return asset?.lastSeenAt || asset?.agent?.lastSeenAt || asset?.collectedAt || null;
}

export function hasRemoteAssistanceAgent(asset) {
  return Boolean(
    asset &&
      (asset.source === "agent" || asset.agent || asset.agentVersion || asset.agentEnrollmentId)
  );
}

export function isRemoteAssistanceAssetFresh(asset, now = Date.now()) {
  if (!hasRemoteAssistanceAgent(asset)) return false;
  const lastSeenAt = getRemoteAssetLastSeenAt(asset);
  const lastSeenTime = Date.parse(lastSeenAt);
  if (!Number.isFinite(lastSeenTime)) return false;
  const intervalSeconds = Number(
    asset?.agent?.intervalSeconds || asset?.agentIntervalSeconds || asset?.intervalSeconds || 300
  );
  const freshnessWindow = Math.max(intervalSeconds * 3 * 1000, 10 * 60 * 1000);
  return now - lastSeenTime <= freshnessWindow;
}

export function isRemoteAssistanceTerminal(status) {
  return terminalStatuses.has(String(status || ""));
}

export function remoteAssistanceStatusLabel(status) {
  return {
    requested: "Solicitada",
    waiting_consent: "Aguardando autorizacao local",
    consent_denied: "Autorizacao negada",
    connecting: "Conectando",
    active: "Atendimento em andamento",
    ended: "Atendimento encerrado",
    failed: "Falha na sessao",
    expired: "Sessao expirada"
  }[status] || "Preparando atendimento";
}

export function formatRemoteMonitor(monitor, index = 0) {
  const suffix = monitor?.primary ? " - Principal" : "";
  return `${monitor?.name || `Monitor ${index + 1}`} - ${monitor?.width || "?"}x${monitor?.height || "?"}${suffix}`;
}

export function getRemoteAssetDisplayName(asset, alias) {
  return String(alias || asset?.alias || asset?.displayName || asset?.name || asset?.hostname || "Maquina");
}
