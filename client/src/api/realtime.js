import { buildWsUrl } from "./http.js";

/** @import {  } from "./types.js" */

/**
 * @returns {WebSocket | null}
 */
export function createMonitoringSocket() {
  const wsUrl = buildWsUrl();
  if (!wsUrl) return null;

  return new WebSocket(wsUrl);
}
