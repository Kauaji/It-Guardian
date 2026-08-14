import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter } from "./rateLimitMiddleware.js";

function responseDouble() {
  return {
    headers: new Map(),
    statusCode: null,
    payload: null,
    setHeader(name, value) {
      this.headers.set(name, value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test("rate limiter bloqueia tentativas acima do limite", async () => {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    max: 2,
    keyGenerator: () => "test-rate-limit-key"
  });
  const req = { ip: "127.0.0.1", body: {} };
  let nextCalls = 0;

  await limiter(req, responseDouble(), () => { nextCalls += 1; });
  await limiter(req, responseDouble(), () => { nextCalls += 1; });
  const blocked = responseDouble();
  await limiter(req, blocked, () => { nextCalls += 1; });

  assert.equal(nextCalls, 2);
  assert.equal(blocked.statusCode, 429);
  assert.match(blocked.payload.message, /tentativas/i);
});

test("cada instancia do rate limiter tem seu proprio contador, mesmo com a mesma chave", async () => {
  const limiterA = createRateLimiter({ windowMs: 60_000, max: 1, keyGenerator: () => "shared-key", name: "a" });
  const limiterB = createRateLimiter({ windowMs: 60_000, max: 1, keyGenerator: () => "shared-key", name: "b" });
  const req = { ip: "127.0.0.1", body: {} };

  const firstA = responseDouble();
  await limiterA(req, firstA, () => {});
  assert.notEqual(firstA.statusCode, 429);

  // limiterB nunca foi chamado antes -- se compartilhasse estado com
  // limiterA (como o Map global antigo compartilhava entre instancias),
  // esta primeira chamada de B já apareceria bloqueada.
  const firstB = responseDouble();
  await limiterB(req, firstB, () => {});
  assert.notEqual(firstB.statusCode, 429);
});
