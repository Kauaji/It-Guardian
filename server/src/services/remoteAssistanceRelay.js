const relays = new Map();

function relayFor(sessionId) {
  if (!relays.has(sessionId)) {
    relays.set(sessionId, {
      agentToken: null,
      viewerToken: null,
      latestFrame: null,
      frameReceivedAt: null,
      monitors: [],
      selectedMonitorId: null,
      commands: [],
      lastFrameAt: 0,
      lastAgentActivityAt: null,
      controlEngaged: false
    });
  }
  return relays.get(sessionId);
}

export function initializeRelay(sessionId, { agentToken, viewerToken }) {
  const relay = relayFor(sessionId);
  relay.agentToken = agentToken;
  relay.viewerToken = viewerToken;
  return relay;
}

export function getRelay(sessionId) {
  return relays.get(sessionId) || null;
}

export function clearRelay(sessionId) {
  relays.delete(sessionId);
}

export function setRelayAgentState(sessionId, { monitors = [], selectedMonitorId = null } = {}) {
  const relay = relayFor(sessionId);
  relay.monitors = monitors;
  relay.selectedMonitorId = selectedMonitorId || relay.selectedMonitorId || monitors[0]?.id || null;
  relay.lastAgentActivityAt = new Date().toISOString();
  return relay;
}

export function setRelayFrame(sessionId, dataUrl, now = Date.now()) {
  const relay = relayFor(sessionId);
  relay.latestFrame = dataUrl;
  relay.frameReceivedAt = new Date(now).toISOString();
  relay.lastFrameAt = now;
  relay.lastAgentActivityAt = new Date(now).toISOString();
  return relay;
}

export function setRelayControlEngaged(sessionId, engaged) {
  const relay = relayFor(sessionId);
  relay.controlEngaged = Boolean(engaged);
  return relay;
}

export function enqueueRelayCommand(sessionId, command, maxQueuedCommands) {
  const relay = relayFor(sessionId);
  relay.commands.push(command);
  if (relay.commands.length > maxQueuedCommands) {
    relay.commands.splice(0, relay.commands.length - maxQueuedCommands);
  }
}

export function drainRelayCommands(sessionId) {
  const relay = relayFor(sessionId);
  const commands = relay.commands;
  relay.commands = [];
  return commands;
}
