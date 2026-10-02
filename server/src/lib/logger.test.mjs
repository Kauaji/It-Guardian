import assert from "node:assert/strict";
import test from "node:test";
import { logger, redact, redactPath } from "./logger.js";

test("redact esconde segredos por nome de campo, inclusive aninhados", () => {
  const output = redact({
    email: "a@b.com",
    password: "x",
    nested: { authorization: "Bearer abc", agentToken: "t", ok: 1 },
    list: [{ mfaToken: "m", recoveryCode: "ABCDE-FGHIJ" }]
  });
  assert.equal(output.email, "a@b.com");
  assert.equal(output.password, "[REDACTED]");
  assert.equal(output.nested.authorization, "[REDACTED]");
  assert.equal(output.nested.agentToken, "[REDACTED]");
  assert.equal(output.nested.ok, 1);
  assert.equal(output.list[0].mfaToken, "[REDACTED]");
  assert.equal(output.list[0].recoveryCode, "[REDACTED]");
});

test("redactPath tira query string e o token de acompanhamento publico", () => {
  assert.equal(redactPath("/api/public/service-orders/track/abc123SECRET?x=1"), "/api/public/service-orders/track/[REDACTED]");
  assert.equal(redactPath("/api/users?token=segredo"), "/api/users");
});

test("logger emite JSON com requestId do contexto e respeita LOG_LEVEL", () => {
  const lines = [];
  const original = console.warn;
  const originalLevel = process.env.LOG_LEVEL;
  console.warn = (line) => lines.push(JSON.parse(line));
  process.env.LOG_LEVEL = "warn";
  try {
    logger.withRequest("req-abc-12345", () => logger.warn("evento_teste", { password: "x", valor: 1 }));
    process.env.LOG_LEVEL = "error";
    logger.warn("nao_deve_aparecer", {});
  } finally {
    console.warn = original;
    process.env.LOG_LEVEL = originalLevel;
  }
  assert.equal(lines.length, 1);
  assert.equal(lines[0].event, "evento_teste");
  assert.equal(lines[0].requestId, "req-abc-12345");
  assert.equal(lines[0].password, "[REDACTED]");
  assert.equal(lines[0].valor, 1);
});
