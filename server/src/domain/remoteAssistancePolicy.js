const activeStatuses = new Set(["requested", "waiting_consent", "connecting", "active"]);

export function assertRemoteAssistanceEnabled(config) {
  if (config?.enabled) return;
  const error = new Error("A assistencia remota esta desativada ou indisponivel neste ambiente.");
  error.statusCode = 403;
  error.expose = true;
  throw error;
}

export function normalizeRequestedMode(value, config, canControl) {
  const mode = String(value || "view").trim().toLowerCase();
  if (!new Set(["view", "control"]).has(mode)) {
    const error = new Error("Modo de assistencia remota invalido.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }
  if (mode === "control" && (!config?.controlEnabled || !canControl)) {
    const error = new Error("Controle remoto nao autorizado para este usuario ou ambiente.");
    error.statusCode = 403;
    error.expose = true;
    throw error;
  }
  return mode;
}

export function canRelayInput({ session, config, canControl }) {
  return Boolean(
    session &&
      session.status === "active" &&
      session.requestedMode === "control" &&
      session.remoteControlEnabled &&
      session.controlConsentGranted &&
      session.consentStatus === "granted" &&
      config?.controlEnabled &&
      canControl
  );
}

export function isSessionActive(status) {
  return activeStatuses.has(status);
}

export function isAgentFresh(asset, now = Date.now()) {
  if (!asset?.lastSeenAt) return false;
  const intervalMs = Math.max(30, Number(asset.intervalSeconds || 300)) * 1000;
  const freshnessWindow = Math.max(3 * intervalMs, 10 * 60 * 1000);
  return now - new Date(asset.lastSeenAt).getTime() <= freshnessWindow;
}
