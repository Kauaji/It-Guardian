import { buildWsUrl } from "./http.js";

export function createMonitoringSocket() {
  const wsUrl = buildWsUrl();
  if (!wsUrl) return null;

  return new WebSocket(wsUrl);
}
