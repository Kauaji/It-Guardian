import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  appendRelayChatMessage,
  clearRelay,
  computeRelayMetrics,
  createRedisStore,
  drainRelayCommands,
  enqueueRelayCommand,
  getRelay,
  getRelayBackendName,
  getRelayChatMessages,
  getRelayFrame,
  initializeRelay,
  setRelayAdaptiveQuality,
  setRelayFrame,
  setRelayViewerPaused,
  touchRelayFrame
} from "./remoteAssistanceRelay.js";

function freshSessionId() {
  return `relay-test-${randomUUID()}`;
}

test("sem credenciais de Redis no ambiente, o relay usa o backend em memoria", () => {
  assert.equal(getRelayBackendName(), "memory");
});

test("relay comeca vazio e e limpo por completo ao encerrar a sessao", async () => {
  const sessionId = freshSessionId();
  await initializeRelay(sessionId, { agentToken: "agent-token", viewerToken: "viewer-token" });
  assert.ok(await getRelay(sessionId));
  await setRelayFrame(sessionId, "data:image/jpeg;base64,AAA=", { bytes: 10, hash: "h", now: 1 });
  assert.ok(await getRelayFrame(sessionId));
  await clearRelay(sessionId);
  assert.equal(await getRelay(sessionId), null);
  assert.equal(await getRelayFrame(sessionId), null);
});

test("frames identicos (mesmo hash) nao contam para a janela de FPS/bytes", async () => {
  const sessionId = freshSessionId();
  await initializeRelay(sessionId, { agentToken: "a", viewerToken: "v" });

  await setRelayFrame(sessionId, "data:image/jpeg;base64,AAA=", { bytes: 1000, hash: "hash-1", now: 1000 });
  await setRelayFrame(sessionId, "data:image/jpeg;base64,AAA=", { bytes: 1000, hash: "hash-1", now: 1300 });
  await setRelayFrame(sessionId, "data:image/jpeg;base64,BBB=", { bytes: 1200, hash: "hash-2", now: 1600 });

  const relay = await getRelay(sessionId);
  assert.equal(relay.framesTotal, 3);
  assert.equal(relay.duplicateFramesSkipped, 1);
  assert.equal(await getRelayFrame(sessionId), "data:image/jpeg;base64,BBB=");

  const metrics = computeRelayMetrics(relay, 1600);
  assert.equal(metrics.framesTotal, 3);
  assert.equal(metrics.duplicateFramesSkipped, 1);
  assert.equal(metrics.lastFrameBytes, 1200);
  assert.ok(metrics.fps > 0);
  await clearRelay(sessionId);
});

test("metricas refletem null quando o relay nao existe mais", () => {
  assert.equal(computeRelayMetrics(null), null);
});

test("comandos sao drenados uma unica vez e respeitam o limite de fila", async () => {
  const sessionId = freshSessionId();
  await initializeRelay(sessionId, { agentToken: "a", viewerToken: "v" });
  for (let i = 0; i < 5; i += 1) {
    await enqueueRelayCommand(sessionId, { id: String(i), type: "mouse_move", x: 0, y: 0 }, 3);
  }
  const drained = await drainRelayCommands(sessionId);
  assert.equal(drained.length, 3);
  assert.deepEqual(drained.map((command) => command.id), ["2", "3", "4"]);
  assert.deepEqual(await drainRelayCommands(sessionId), []);
  await clearRelay(sessionId);
});

test("pausa do viewer fica visivel nas metricas do relay", async () => {
  const sessionId = freshSessionId();
  await initializeRelay(sessionId, { agentToken: "a", viewerToken: "v" });
  await setRelayViewerPaused(sessionId, true);
  const metrics = computeRelayMetrics(await getRelay(sessionId));
  assert.equal(metrics.paused, true);
  await clearRelay(sessionId);
});

test("ping de tela inalterada renova o relay sem contar como novo frame", async () => {
  const sessionId = freshSessionId();
  await initializeRelay(sessionId, { agentToken: "a", viewerToken: "v" });
  await setRelayFrame(sessionId, "data:image/jpeg;base64,AAA=", { bytes: 900, hash: "hash-1", now: 1000 });

  await touchRelayFrame(sessionId, 2000);

  const relay = await getRelay(sessionId);
  assert.equal(relay.framesTotal, 1);
  assert.equal(relay.unchangedPings, 1);
  assert.equal(relay.lastFrameAt, 2000);
  assert.equal(await getRelayFrame(sessionId), "data:image/jpeg;base64,AAA=");

  const metrics = computeRelayMetrics(relay, 2000);
  assert.equal(metrics.framesTotal, 1);
  assert.equal(metrics.unchangedPings, 1);
  assert.equal(metrics.frameAgeMs, 0);
  await clearRelay(sessionId);
});

test("hint de qualidade adaptativa fica disponivel para o proximo poll do agente", async () => {
  const sessionId = freshSessionId();
  await initializeRelay(sessionId, { agentToken: "a", viewerToken: "v", quality: 65, width: 1280, height: 720 });
  await setRelayAdaptiveQuality(sessionId, { quality: 50, width: 1024, height: 576 });
  const metrics = computeRelayMetrics(await getRelay(sessionId));
  assert.equal(metrics.quality, 50);
  assert.equal(metrics.width, 1024);
  assert.equal(metrics.height, 576);
  await clearRelay(sessionId);
});

test("mensagens de chat ficam disponiveis para leitura nao-destrutiva e respeitam o limite", async () => {
  const sessionId = freshSessionId();
  await initializeRelay(sessionId, { agentToken: "a", viewerToken: "v" });

  await appendRelayChatMessage(sessionId, { id: "1", sender: "technician", text: "Oi" });
  await appendRelayChatMessage(sessionId, { id: "2", sender: "agent", text: "Ola" });

  assert.deepEqual(
    (await getRelayChatMessages(sessionId)).map((message) => message.id),
    ["1", "2"]
  );
  // Leitura nao consome: uma segunda chamada ve as mesmas mensagens.
  assert.equal((await getRelayChatMessages(sessionId)).length, 2);

  for (let i = 3; i <= 205; i += 1) {
    await appendRelayChatMessage(sessionId, { id: String(i), sender: "agent", text: "msg" });
  }
  const messages = await getRelayChatMessages(sessionId);
  assert.equal(messages.length, 200);
  assert.equal(messages[0].id, "6");
  assert.equal(messages[messages.length - 1].id, "205");
  await clearRelay(sessionId);
});

test("limpar a sessao tambem remove o historico de chat", async () => {
  const sessionId = freshSessionId();
  await initializeRelay(sessionId, { agentToken: "a", viewerToken: "v" });
  await appendRelayChatMessage(sessionId, { id: "1", sender: "technician", text: "Oi" });
  await clearRelay(sessionId);
  assert.deepEqual(await getRelayChatMessages(sessionId), []);
});

// --- Backend Redis (Upstash), validado com um cliente falso -----------------
// Sem depender de um Redis real: confere que o modulo fala com o cliente Redis
// da forma certa (chaves, JSON, TTL e drenagem atomica da fila de comandos),
// o que e exatamente o que muda entre rodar local e rodar no Vercel.

function createFakeRedisClient() {
  const values = new Map();
  const lists = new Map();
  const ttlCalls = [];
  const getCalls = [];
  return {
    async get(key) {
      getCalls.push(key);
      return values.has(key) ? values.get(key) : null;
    },
    async set(key, value, opts) {
      values.set(key, value);
      if (opts?.ex) ttlCalls.push({ key, ex: opts.ex });
      return "OK";
    },
    async del(key) {
      const existed = values.delete(key) || lists.delete(key);
      return existed ? 1 : 0;
    },
    async rpush(key, value) {
      const list = lists.get(key) || [];
      list.push(value);
      lists.set(key, list);
      return list.length;
    },
    async lpop(key, count = 1) {
      const list = lists.get(key) || [];
      if (!list.length) return null;
      const popped = list.splice(0, count);
      lists.set(key, list);
      return popped;
    },
    async ltrim(key, start, stop) {
      const list = lists.get(key) || [];
      const trimmed = start < 0 && stop === -1 ? list.slice(start) : list.slice(start, stop + 1);
      lists.set(key, trimmed);
      return "OK";
    },
    async lrange(key, start, stop) {
      const list = lists.get(key) || [];
      return start === 0 && stop === -1 ? list.slice() : list.slice(start, stop + 1);
    },
    async expire() {
      return 1;
    },
    _ttlCalls: ttlCalls,
    _getCalls: getCalls,
    _rawValue: (key) => values.get(key),
    _rawList: (key) => lists.get(key) || []
  };
}

test("store Redis: guarda e devolve o relay via JSON, com TTL aplicado", async () => {
  const client = createFakeRedisClient();
  const redisStore = createRedisStore(client);
  const sessionId = freshSessionId();

  assert.equal(await redisStore.get(sessionId), null);

  const { relay } = await redisStore.mutate(sessionId, (relay) => {
    relay.agentToken = "agent-x";
    relay.quality = 60;
  });
  assert.equal(relay.agentToken, "agent-x");

  const fetched = await redisStore.get(sessionId);
  assert.equal(fetched.agentToken, "agent-x");
  assert.equal(fetched.quality, 60);
  assert.ok(Array.isArray(fetched.frameWindow));
  assert.ok(client._ttlCalls.some((call) => call.ex === 1800));
  assert.equal(fetched.latestFrame, undefined, "o JPEG nao deve viver dentro do blob de metadados");
});

test("store Redis: o frame fica numa chave propria e a escrita nao le o valor antigo primeiro", async () => {
  const client = createFakeRedisClient();
  const redisStore = createRedisStore(client);
  const sessionId = freshSessionId();

  assert.equal(await redisStore.getFrame(sessionId), null);

  const getCallsBefore = client._getCalls.length;
  await redisStore.setFrame(sessionId, "data:image/jpeg;base64,AAA=");
  assert.equal(
    client._getCalls.length,
    getCallsBefore,
    "setFrame deve ser um SET puro, sem GET do valor antigo antes"
  );

  assert.equal(await redisStore.getFrame(sessionId), "data:image/jpeg;base64,AAA=");
  assert.equal(client._rawValue(`remote-assistance:relay:${sessionId}:frame`), "data:image/jpeg;base64,AAA=");
  assert.ok(client._ttlCalls.some((call) => call.key === `remote-assistance:relay:${sessionId}:frame` && call.ex === 1800));

  await redisStore.mutate(sessionId, (relay) => { relay.agentToken = "a"; });
  assert.equal(
    await redisStore.getFrame(sessionId),
    "data:image/jpeg;base64,AAA=",
    "mutacoes de metadados nao devem afetar o frame guardado separadamente"
  );
});

test("store Redis: mutacoes sucessivas leem o estado mais recente (nao perdem escrita anterior)", async () => {
  const client = createFakeRedisClient();
  const redisStore = createRedisStore(client);
  const sessionId = freshSessionId();

  await redisStore.mutate(sessionId, (relay) => { relay.monitors = [{ id: "d1" }]; });
  await redisStore.mutate(sessionId, (relay) => { relay.viewerPaused = true; });

  const relay = await redisStore.get(sessionId);
  assert.deepEqual(relay.monitors, [{ id: "d1" }]);
  assert.equal(relay.viewerPaused, true);
});

test("store Redis: clear remove estado, frame e fila de comandos", async () => {
  const client = createFakeRedisClient();
  const redisStore = createRedisStore(client);
  const sessionId = freshSessionId();

  await redisStore.mutate(sessionId, (relay) => { relay.agentToken = "a"; });
  await redisStore.setFrame(sessionId, "data:image/jpeg;base64,AAA=");
  await redisStore.enqueueCommand(sessionId, { type: "mouse_move" }, 10);

  await redisStore.clear(sessionId);

  assert.equal(await redisStore.get(sessionId), null);
  assert.equal(await redisStore.getFrame(sessionId), null);
  assert.deepEqual(await redisStore.drainCommands(sessionId), []);
});

test("store Redis: fila de comandos usa RPUSH/LPOP atomico e respeita o limite", async () => {
  const client = createFakeRedisClient();
  const redisStore = createRedisStore(client);
  const sessionId = freshSessionId();

  for (let i = 0; i < 5; i += 1) {
    await redisStore.enqueueCommand(sessionId, { id: String(i) }, 3);
  }
  assert.equal(client._rawList(`remote-assistance:relay:${sessionId}:cmds`).length, 3);

  const drained = await redisStore.drainCommands(sessionId);
  assert.deepEqual(drained.map((command) => command.id), ["2", "3", "4"]);
  assert.deepEqual(await redisStore.drainCommands(sessionId), []);
});

test("store Redis: chat usa RPUSH/LTRIM e leitura via LRANGE nao destroi a lista", async () => {
  const client = createFakeRedisClient();
  const redisStore = createRedisStore(client);
  const sessionId = freshSessionId();

  await redisStore.appendChatMessage(sessionId, { id: "1", text: "Oi" });
  await redisStore.appendChatMessage(sessionId, { id: "2", text: "Ola" });

  assert.deepEqual(
    (await redisStore.getChatMessages(sessionId)).map((message) => message.id),
    ["1", "2"]
  );
  assert.equal((await redisStore.getChatMessages(sessionId)).length, 2);

  await redisStore.clear(sessionId);
  assert.deepEqual(await redisStore.getChatMessages(sessionId), []);
});
