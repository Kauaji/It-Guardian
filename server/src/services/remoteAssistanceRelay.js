const relays = new Map();
const FRAME_WINDOW_SIZE = 8;

function relayFor(sessionId) {
  if (!relays.has(sessionId)) {
    relays.set(sessionId, {
      agentToken: null,
      viewerToken: null,
      latestFrame: null,
      latestFrameHash: null,
      frameReceivedAt: null,
      lastFrameBytes: 0,
      frameWindow: [],
      framesTotal: 0,
      bytesTotal: 0,
      duplicateFramesSkipped: 0,
      unchangedPings: 0,
      monitors: [],
      selectedMonitorId: null,
      commands: [],
      lastFrameAt: 0,
      lastAgentActivityAt: null,
      controlEngaged: false,
      viewerPaused: false,
      quality: null,
      width: null,
      height: null,
      webrtcOffer: null,
      webrtcOfferAt: null,
      webrtcAnswer: null,
      webrtcAnswerAt: null
    });
  }
  return relays.get(sessionId);
}

export function initializeRelay(sessionId, { agentToken, viewerToken, quality = null, width = null, height = null }) {
  const relay = relayFor(sessionId);
  relay.agentToken = agentToken;
  relay.viewerToken = viewerToken;
  relay.quality = quality;
  relay.width = width;
  relay.height = height;
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

/**
 * Ping leve enviado pelo agente quando a tela nao mudou: mantem o relay
 * "fresco" (para o estado de conexao no viewer) sem custo de banda de um
 * JPEG completo e sem contar como novo frame nas metricas de FPS/bytes.
 */
export function touchRelayFrame(sessionId, now = Date.now()) {
  const relay = relayFor(sessionId);
  relay.frameReceivedAt = new Date(now).toISOString();
  relay.lastFrameAt = now;
  relay.lastAgentActivityAt = relay.frameReceivedAt;
  relay.unchangedPings = (relay.unchangedPings || 0) + 1;
  return relay;
}

/**
 * Registra um frame aceito. Quadros identicos ao anterior (mesmo hash) nao
 * entram na janela de FPS/bytes-por-segundo, evitando que uma tela estatica
 * infle as metricas exibidas no viewer.
 */
export function setRelayFrame(sessionId, dataUrl, { bytes = 0, hash = null, now = Date.now() } = {}) {
  const relay = relayFor(sessionId);
  const duplicate = Boolean(hash) && hash === relay.latestFrameHash;
  relay.latestFrame = dataUrl;
  if (hash) relay.latestFrameHash = hash;
  relay.frameReceivedAt = new Date(now).toISOString();
  relay.lastFrameAt = now;
  relay.lastAgentActivityAt = relay.frameReceivedAt;
  relay.lastFrameBytes = bytes;
  relay.framesTotal += 1;
  relay.bytesTotal += bytes;
  if (duplicate) {
    relay.duplicateFramesSkipped += 1;
  } else {
    relay.frameWindow.push({ at: now, bytes });
    if (relay.frameWindow.length > FRAME_WINDOW_SIZE) relay.frameWindow.shift();
  }
  return { relay, duplicate };
}

export function setRelayAdaptiveQuality(sessionId, { quality, width, height }) {
  const relay = relayFor(sessionId);
  relay.quality = quality;
  relay.width = width;
  relay.height = height;
  return relay;
}

export function setRelayViewerPaused(sessionId, paused) {
  const relay = relayFor(sessionId);
  relay.viewerPaused = Boolean(paused);
  return relay;
}

/**
 * Caixa efemera de sinalizacao WebRTC (oferta/resposta SDP). Assim como o
 * frame de tela, nunca e persistida em banco e some quando o relay e limpo.
 */
export function setRelayWebrtcOffer(sessionId, sdp, now = Date.now()) {
  const relay = relayFor(sessionId);
  relay.webrtcOffer = sdp;
  relay.webrtcOfferAt = new Date(now).toISOString();
  relay.webrtcAnswer = null;
  relay.webrtcAnswerAt = null;
  return relay;
}

export function setRelayWebrtcAnswer(sessionId, sdp, now = Date.now()) {
  const relay = relayFor(sessionId);
  relay.webrtcAnswer = sdp;
  relay.webrtcAnswerAt = new Date(now).toISOString();
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

/**
 * Metricas somente operacionais (nunca conteudo do frame) para o viewer:
 * FPS real na janela recente, bytes/s, tamanho do ultimo frame e ha quanto
 * tempo nao chega frame novo.
 */
export function computeRelayMetrics(relay, now = Date.now()) {
  if (!relay) return null;
  const window = relay.frameWindow;
  let fps = 0;
  let bytesPerSecond = 0;
  if (window.length >= 2) {
    const spanMs = window[window.length - 1].at - window[0].at;
    if (spanMs > 0) {
      fps = Math.round(((window.length - 1) / spanMs) * 1000 * 10) / 10;
      const bytesInWindow = window.slice(1).reduce((sum, item) => sum + item.bytes, 0);
      bytesPerSecond = Math.round((bytesInWindow / spanMs) * 1000);
    }
  }
  return {
    fps,
    bytesPerSecond,
    lastFrameBytes: relay.lastFrameBytes,
    framesTotal: relay.framesTotal,
    duplicateFramesSkipped: relay.duplicateFramesSkipped,
    unchangedPings: relay.unchangedPings || 0,
    frameAgeMs: relay.lastFrameAt ? Math.max(0, now - relay.lastFrameAt) : null,
    quality: relay.quality,
    width: relay.width,
    height: relay.height,
    paused: Boolean(relay.viewerPaused)
  };
}
