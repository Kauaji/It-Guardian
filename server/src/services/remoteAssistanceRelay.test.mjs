import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  clearRelay,
  computeRelayMetrics,
  drainRelayCommands,
  enqueueRelayCommand,
  getRelay,
  initializeRelay,
  setRelayAdaptiveQuality,
  setRelayFrame,
  setRelayViewerPaused,
  touchRelayFrame
} from "./remoteAssistanceRelay.js";

function freshSessionId() {
  return `relay-test-${randomUUID()}`;
}

test("relay comeca vazio e e limpo por completo ao encerrar a sessao", () => {
  const sessionId = freshSessionId();
  initializeRelay(sessionId, { agentToken: "agent-token", viewerToken: "viewer-token" });
  assert.ok(getRelay(sessionId));
  clearRelay(sessionId);
  assert.equal(getRelay(sessionId), null);
});

test("frames identicos (mesmo hash) nao contam para a janela de FPS/bytes", () => {
  const sessionId = freshSessionId();
  initializeRelay(sessionId, { agentToken: "a", viewerToken: "v" });

  setRelayFrame(sessionId, "data:image/jpeg;base64,AAA=", { bytes: 1000, hash: "hash-1", now: 1000 });
  setRelayFrame(sessionId, "data:image/jpeg;base64,AAA=", { bytes: 1000, hash: "hash-1", now: 1300 });
  setRelayFrame(sessionId, "data:image/jpeg;base64,BBB=", { bytes: 1200, hash: "hash-2", now: 1600 });

  const relay = getRelay(sessionId);
  assert.equal(relay.framesTotal, 3);
  assert.equal(relay.duplicateFramesSkipped, 1);

  const metrics = computeRelayMetrics(relay, 1600);
  assert.equal(metrics.framesTotal, 3);
  assert.equal(metrics.duplicateFramesSkipped, 1);
  assert.equal(metrics.lastFrameBytes, 1200);
  assert.ok(metrics.fps > 0);
  clearRelay(sessionId);
});

test("metricas refletem null quando o relay nao existe mais", () => {
  assert.equal(computeRelayMetrics(null), null);
});

test("comandos sao drenados uma unica vez e respeitam o limite de fila", () => {
  const sessionId = freshSessionId();
  initializeRelay(sessionId, { agentToken: "a", viewerToken: "v" });
  for (let i = 0; i < 5; i += 1) {
    enqueueRelayCommand(sessionId, { id: String(i), type: "mouse_move", x: 0, y: 0 }, 3);
  }
  const drained = drainRelayCommands(sessionId);
  assert.equal(drained.length, 3);
  assert.deepEqual(drained.map((command) => command.id), ["2", "3", "4"]);
  assert.deepEqual(drainRelayCommands(sessionId), []);
  clearRelay(sessionId);
});

test("pausa do viewer fica visivel nas metricas do relay", () => {
  const sessionId = freshSessionId();
  initializeRelay(sessionId, { agentToken: "a", viewerToken: "v" });
  setRelayViewerPaused(sessionId, true);
  const metrics = computeRelayMetrics(getRelay(sessionId));
  assert.equal(metrics.paused, true);
  clearRelay(sessionId);
});

test("ping de tela inalterada renova o relay sem contar como novo frame", () => {
  const sessionId = freshSessionId();
  initializeRelay(sessionId, { agentToken: "a", viewerToken: "v" });
  setRelayFrame(sessionId, "data:image/jpeg;base64,AAA=", { bytes: 900, hash: "hash-1", now: 1000 });

  touchRelayFrame(sessionId, 2000);

  const relay = getRelay(sessionId);
  assert.equal(relay.framesTotal, 1);
  assert.equal(relay.unchangedPings, 1);
  assert.equal(relay.lastFrameAt, 2000);
  assert.equal(relay.latestFrame, "data:image/jpeg;base64,AAA=");

  const metrics = computeRelayMetrics(relay, 2000);
  assert.equal(metrics.framesTotal, 1);
  assert.equal(metrics.unchangedPings, 1);
  assert.equal(metrics.frameAgeMs, 0);
  clearRelay(sessionId);
});

test("hint de qualidade adaptativa fica disponivel para o proximo poll do agente", () => {
  const sessionId = freshSessionId();
  initializeRelay(sessionId, { agentToken: "a", viewerToken: "v", quality: 65, width: 1280, height: 720 });
  setRelayAdaptiveQuality(sessionId, { quality: 50, width: 1024, height: 576 });
  const metrics = computeRelayMetrics(getRelay(sessionId));
  assert.equal(metrics.quality, 50);
  assert.equal(metrics.width, 1024);
  assert.equal(metrics.height, 576);
  clearRelay(sessionId);
});
