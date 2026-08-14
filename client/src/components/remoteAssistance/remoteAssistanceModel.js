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
      (asset.source === "agent" ||
        asset.agent ||
        asset.agentVersion ||
        asset.agentEnrollmentId ||
        (Array.isArray(asset.dataSources) && asset.dataSources.includes("agent")))
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
    reconnecting: "Sem quadros recentes - reconectando",
    agent_offline: "Agente sem resposta",
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

export function remoteAssistanceTransportLabel(transport) {
  return transport === "webrtc" ? "WebRTC" : "Snapshot seguro (HTTP)";
}

export function formatBytesPerSecond(bytesPerSecond) {
  const value = Number(bytesPerSecond) || 0;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB/s`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB/s`;
  return `${value} B/s`;
}

export function formatFrameSize(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

export function isRemoteAssistanceFrameStale(metrics, viewerPollMs = 1000) {
  const frameAgeMs = Number(metrics?.frameAgeMs);
  if (!Number.isFinite(frameAgeMs)) return false;
  return frameAgeMs > Math.max(1000, viewerPollMs * 4);
}
