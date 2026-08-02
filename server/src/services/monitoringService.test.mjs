import assert from "node:assert/strict";
import test from "node:test";
import { deriveContactStatus } from "./monitoringService.js";

const now = Date.parse("2026-08-02T12:00:00.000Z");

test("contato ausente fica offline antes de completar tres dias", () => {
  assert.equal(deriveContactStatus("offline", "2026-07-31T12:01:00.000Z", now), "offline");
});

test("contato ausente vira erro somente depois de tres dias", () => {
  assert.equal(deriveContactStatus("offline", "2026-07-30T11:59:00.000Z", now), "problem");
});

test("maquina online e desconhecida preservam seus estados", () => {
  assert.equal(deriveContactStatus("online", "2026-07-01T00:00:00.000Z", now), "online");
  assert.equal(deriveContactStatus("unknown", null, now), "unknown");
});
