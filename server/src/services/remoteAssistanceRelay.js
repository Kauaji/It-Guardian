import { Redis } from "@upstash/redis";

const FRAME_WINDOW_SIZE = 8;
const RELAY_TTL_SECONDS = 1800;
const RELAY_KEY_PREFIX = "remote-assistance:relay:";
const COMMANDS_KEY_SUFFIX = ":cmds";
const CHAT_KEY_SUFFIX = ":chat";
const MAX_CHAT_MESSAGES = 200;

function emptyRelay() {
  return {
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
  };
}

/**
 * Backend em memoria (padrao para desenvolvimento local e para o perfil
 * Docker, onde a API roda como um unico processo persistente). Nao serve
 * para producao serverless: cada instancia teria sua propria memoria.
 */
export function createMemoryStore() {
  const relays = new Map();
  const commandQueues = new Map();
  const chatLogs = new Map();

  return {
    name: "memory",
    async get(sessionId) {
      return relays.get(sessionId) || null;
    },
    async mutate(sessionId, mutator) {
      const relay = relays.get(sessionId) || emptyRelay();
      const result = mutator(relay);
      relays.set(sessionId, relay);
      return { relay, result };
    },
    async clear(sessionId) {
      relays.delete(sessionId);
      commandQueues.delete(sessionId);
      chatLogs.delete(sessionId);
    },
    async enqueueCommand(sessionId, command, maxQueuedCommands) {
      const queue = commandQueues.get(sessionId) || [];
      queue.push(command);
      if (queue.length > maxQueuedCommands) {
        queue.splice(0, queue.length - maxQueuedCommands);
      }
      commandQueues.set(sessionId, queue);
    },
    async drainCommands(sessionId) {
      const queue = commandQueues.get(sessionId) || [];
      commandQueues.delete(sessionId);
      return queue;
    },
    async appendChatMessage(sessionId, message) {
      const log = chatLogs.get(sessionId) || [];
      log.push(message);
      if (log.length > MAX_CHAT_MESSAGES) {
        log.splice(0, log.length - MAX_CHAT_MESSAGES);
      }
      chatLogs.set(sessionId, log);
    },
    async getChatMessages(sessionId) {
      return (chatLogs.get(sessionId) || []).slice();
    }
  };
}

/**
 * Backend Redis (Upstash), necessario em deploy serverless (Vercel): cada
 * instancia da funcao le/escreve o mesmo relay externo, em vez de depender
 * de memoria de processo que nao e compartilhada entre instancias.
 *
 * O estado do relay (sem os comandos) fica numa unica chave JSON com TTL de
 * seguranca, renovado a cada escrita. A fila de comandos fica numa lista
 * Redis separada, usando RPUSH/LPOP para permanecer atomica mesmo sob
 * chamadas concorrentes (evita perder um clique ou tecla por causa de uma
 * corrida de leitura-modificacao-escrita).
 */
export function createRedisStore(redisClient) {
  const key = (sessionId) => `${RELAY_KEY_PREFIX}${sessionId}`;
  const commandsKey = (sessionId) => `${RELAY_KEY_PREFIX}${sessionId}${COMMANDS_KEY_SUFFIX}`;
  const chatKey = (sessionId) => `${RELAY_KEY_PREFIX}${sessionId}${CHAT_KEY_SUFFIX}`;

  function parseRelay(raw) {
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  function parseListItem(raw) {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  return {
    name: "redis",
    async get(sessionId) {
      return parseRelay(await redisClient.get(key(sessionId)));
    },
    async mutate(sessionId, mutator) {
      const relay = parseRelay(await redisClient.get(key(sessionId))) || emptyRelay();
      const result = mutator(relay);
      await redisClient.set(key(sessionId), JSON.stringify(relay), { ex: RELAY_TTL_SECONDS });
      return { relay, result };
    },
    async clear(sessionId) {
      await Promise.all([
        redisClient.del(key(sessionId)),
        redisClient.del(commandsKey(sessionId)),
        redisClient.del(chatKey(sessionId))
      ]);
    },
    async enqueueCommand(sessionId, command, maxQueuedCommands) {
      const k = commandsKey(sessionId);
      await redisClient.rpush(k, JSON.stringify(command));
      await redisClient.ltrim(k, -maxQueuedCommands, -1);
      await redisClient.expire(k, RELAY_TTL_SECONDS);
    },
    async drainCommands(sessionId) {
      const items = await redisClient.lpop(commandsKey(sessionId), 1000);
      if (!items) return [];
      return items.map(parseListItem);
    },
    async appendChatMessage(sessionId, message) {
      const k = chatKey(sessionId);
      await redisClient.rpush(k, JSON.stringify(message));
      await redisClient.ltrim(k, -MAX_CHAT_MESSAGES, -1);
      await redisClient.expire(k, RELAY_TTL_SECONDS);
    },
    async getChatMessages(sessionId) {
      const items = await redisClient.lrange(chatKey(sessionId), 0, -1);
      if (!items) return [];
      return items.map(parseListItem);
    }
  };
}

function detectRedisConfig(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function createDefaultStore() {
  const redisConfig = detectRedisConfig();
  if (!redisConfig) return createMemoryStore();
  return createRedisStore(new Redis({ url: redisConfig.url, token: redisConfig.token }));
}

const store = createDefaultStore();

/** Nome do backend em uso ("memory" ou "redis") — util para diagnostico. */
export function getRelayBackendName() {
  return store.name;
}

export async function initializeRelay(sessionId, { agentToken, viewerToken, quality = null, width = null, height = null }) {
  const { relay } = await store.mutate(sessionId, (relay) => {
    relay.agentToken = agentToken;
    relay.viewerToken = viewerToken;
    relay.quality = quality;
    relay.width = width;
    relay.height = height;
  });
  return relay;
}

export async function getRelay(sessionId) {
  return store.get(sessionId);
}

export async function clearRelay(sessionId) {
  await store.clear(sessionId);
}

export async function setRelayAgentState(sessionId, { monitors = [], selectedMonitorId = null } = {}) {
  const { relay } = await store.mutate(sessionId, (relay) => {
    relay.monitors = monitors;
    relay.selectedMonitorId = selectedMonitorId || relay.selectedMonitorId || monitors[0]?.id || null;
    relay.lastAgentActivityAt = new Date().toISOString();
  });
  return relay;
}

/**
 * Ping leve enviado pelo agente quando a tela nao mudou: mantem o relay
 * "fresco" (para o estado de conexao no viewer) sem custo de banda de um
 * JPEG completo e sem contar como novo frame nas metricas de FPS/bytes.
 */
export async function touchRelayFrame(sessionId, now = Date.now()) {
  const { relay } = await store.mutate(sessionId, (relay) => {
    relay.frameReceivedAt = new Date(now).toISOString();
    relay.lastFrameAt = now;
    relay.lastAgentActivityAt = relay.frameReceivedAt;
    relay.unchangedPings = (relay.unchangedPings || 0) + 1;
  });
  return relay;
}

/**
 * Registra um frame aceito. Quadros identicos ao anterior (mesmo hash) nao
 * entram na janela de FPS/bytes-por-segundo, evitando que uma tela estatica
 * infle as metricas exibidas no viewer.
 */
export async function setRelayFrame(sessionId, dataUrl, { bytes = 0, hash = null, now = Date.now() } = {}) {
  let duplicate = false;
  const { relay } = await store.mutate(sessionId, (relay) => {
    duplicate = Boolean(hash) && hash === relay.latestFrameHash;
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
  });
  return { relay, duplicate };
}

export async function setRelayAdaptiveQuality(sessionId, { quality, width, height }) {
  const { relay } = await store.mutate(sessionId, (relay) => {
    relay.quality = quality;
    relay.width = width;
    relay.height = height;
  });
  return relay;
}

export async function setRelayViewerPaused(sessionId, paused) {
  const { relay } = await store.mutate(sessionId, (relay) => {
    relay.viewerPaused = Boolean(paused);
  });
  return relay;
}

/**
 * Caixa efemera de sinalizacao WebRTC (oferta/resposta SDP). Assim como o
 * frame de tela, nunca e persistida em banco e some quando o relay e limpo.
 */
export async function setRelayWebrtcOffer(sessionId, sdp, now = Date.now()) {
  const { relay } = await store.mutate(sessionId, (relay) => {
    relay.webrtcOffer = sdp;
    relay.webrtcOfferAt = new Date(now).toISOString();
    relay.webrtcAnswer = null;
    relay.webrtcAnswerAt = null;
  });
  return relay;
}

export async function setRelayWebrtcAnswer(sessionId, sdp, now = Date.now()) {
  const { relay } = await store.mutate(sessionId, (relay) => {
    relay.webrtcAnswer = sdp;
    relay.webrtcAnswerAt = new Date(now).toISOString();
  });
  return relay;
}

export async function setRelayControlEngaged(sessionId, engaged) {
  const { relay } = await store.mutate(sessionId, (relay) => {
    relay.controlEngaged = Boolean(engaged);
  });
  return relay;
}

export async function enqueueRelayCommand(sessionId, command, maxQueuedCommands) {
  await store.enqueueCommand(sessionId, command, maxQueuedCommands);
}

export async function drainRelayCommands(sessionId) {
  return store.drainCommands(sessionId);
}

/**
 * Mensagens de chat da sessao: mesma fila atomica RPUSH/LTRIM dos comandos de
 * entrada, mas de leitura nao-destrutiva (LRANGE) - ao contrario de um
 * comando, uma mensagem precisa continuar visivel para os dois lados
 * enquanto a sessao durar. O cliente deduplica pelo id de cada mensagem em
 * vez de um cursor por posicao, ja que o LTRIM desloca indices ao podar o
 * historico.
 */
export async function appendRelayChatMessage(sessionId, message) {
  await store.appendChatMessage(sessionId, message);
}

export async function getRelayChatMessages(sessionId) {
  return store.getChatMessages(sessionId);
}

/**
 * Metricas somente operacionais (nunca conteudo do frame) para o viewer:
 * FPS real na janela recente, bytes/s, tamanho do ultimo frame e ha quanto
 * tempo nao chega frame novo. Funcao pura sobre um relay ja carregado.
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
