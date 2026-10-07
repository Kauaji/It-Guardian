import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeInputCommand } from "./remoteAssistanceInput.js";
import {
  canManageSession,
  decodeFrame,
  hashToken,
  issueSessionToken,
  monitorListsEqual,
  normalizeChatMessageText,
  normalizeMonitors,
  normalizeReason
} from "./remoteAssistancePayload.js";

test("entrada remota: so comandos conhecidos, valores limitados e teclas permitidas", () => {
  assert.deepEqual(sanitizeInputCommand({ type: "mouse_move", x: 2, y: -1 }), { type: "mouse_move", x: 1, y: 0 });
  assert.equal(sanitizeInputCommand({ type: "mouse_move", x: "a", y: 0 }), null);
  assert.deepEqual(sanitizeInputCommand({ type: "mouse_button", button: "LEFT", action: "Click" }), {
    type: "mouse_button",
    button: "left",
    action: "click"
  });
  assert.equal(sanitizeInputCommand({ type: "mouse_button", button: "x", action: "click" }), null);
  assert.equal(sanitizeInputCommand({ type: "mouse_button", button: "left", action: "drag" }), null);
  assert.deepEqual(sanitizeInputCommand({ type: "mouse_wheel", delta: 99999.9 }), { type: "mouse_wheel", delta: 1200 });
  assert.equal(sanitizeInputCommand({ type: "mouse_wheel", delta: "x" }), null);
  assert.deepEqual(sanitizeInputCommand({ type: "key", key: "a" }), { type: "key", key: "a", action: "press" });
  assert.deepEqual(sanitizeInputCommand({ type: "key", key: "Enter", action: "DOWN" }), { type: "key", key: "Enter", action: "down" });
  assert.equal(sanitizeInputCommand({ type: "key", key: "F13" }), null, "tecla nao listada");
  assert.equal(sanitizeInputCommand({ type: "key", key: "\u0007" }), null, "caractere de controle");
  assert.equal(sanitizeInputCommand({ type: "key", key: "a", action: "hold" }), null);
  assert.deepEqual(sanitizeInputCommand({ type: "block_input", enabled: 1 }), { type: "block_input", enabled: true });
  assert.equal(sanitizeInputCommand({ type: "shell", cmd: "calc" }), null);
  assert.equal(sanitizeInputCommand(null), null);
});

test("motivo e mensagem de chat sao normalizados e validados", () => {
  assert.equal(normalizeReason("  preciso   ajudar \n o usuario "), "preciso ajudar o usuario");
  assert.equal(normalizeReason("x".repeat(900)).length, 500);
  assert.throws(
    () => normalizeReason("abc"),
    (error) => error.statusCode === 400 && error.expose === true
  );
  assert.equal(normalizeChatMessageText("  oi  "), "oi");
  assert.equal(normalizeChatMessageText("a".repeat(5000)).length, 2000);
  assert.throws(() => normalizeChatMessageText("   "), /Mensagem vazia/);
});

test("monitores: limite de 8, normalizacao e comparacao", () => {
  assert.deepEqual(normalizeMonitors("x"), []);
  const monitors = normalizeMonitors([{ id: " 1 ", name: " Principal ", primary: 1, width: 99999, height: 0 }, {}]);
  assert.deepEqual(monitors[0], { id: "1", name: "Principal", primary: true, width: 16384, height: 1 });
  assert.deepEqual(monitors[1], { id: "1", name: "Monitor 2", primary: false, width: 1, height: 1 });
  assert.equal(normalizeMonitors(Array.from({ length: 12 }, () => ({}))).length, 8);
  assert.equal(
    monitorListsEqual(monitors, normalizeMonitors([{ id: "1", name: "Principal", primary: true, width: 16384, height: 1 }, {}])),
    true
  );
  assert.equal(monitorListsEqual(monitors, monitors.slice(0, 1)), false);
  assert.equal(monitorListsEqual(monitors, [monitors[0], { ...monitors[1], width: 2 }]), false);
});

test("quadro de tela: so JPEG base64 valido dentro do limite", () => {
  const body = Buffer.from("fake-jpeg-bytes").toString("base64");
  const decoded = decodeFrame(`data:image/jpeg;base64,${body}`, 1000);
  assert.equal(decoded.bytes, 15);
  assert.match(decoded.hash, /^[0-9a-f]{40}$/);
  assert.throws(
    () => decodeFrame("data:image/png;base64,AAAA", 1000),
    (error) => error.statusCode === 400
  );
  assert.throws(
    () => decodeFrame(`data:image/jpeg;base64,${body}`, 5),
    (error) => error.statusCode === 413
  );
  assert.throws(
    () => decodeFrame(null, 5),
    (error) => error.statusCode === 400
  );
});

test("tokens e permissao de gerenciar a sessao", () => {
  assert.equal(hashToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(hashToken(undefined), hashToken(""));
  const first = issueSessionToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, issueSessionToken());

  const session = { technicianUserId: "t1" };
  assert.equal(canManageSession({ id: "t1" }, session), true);
  assert.equal(canManageSession({ id: "t2", role: "technician", permissions: [] }, session), false);
  assert.equal(canManageSession({ id: "t2", permissions: ["remote_assistance.manage"] }, session), true);
  assert.equal(canManageSession(null, session), false);
  assert.equal(canManageSession({ id: "t1" }, null), false);
});
