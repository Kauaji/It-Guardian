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

test("rate limiter bloqueia tentativas acima do limite", () => {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    max: 2,
    keyGenerator: () => "test-rate-limit-key"
  });
  const req = { ip: "127.0.0.1", body: {} };
  let nextCalls = 0;

  limiter(req, responseDouble(), () => { nextCalls += 1; });
  limiter(req, responseDouble(), () => { nextCalls += 1; });
  const blocked = responseDouble();
  limiter(req, blocked, () => { nextCalls += 1; });

  assert.equal(nextCalls, 2);
  assert.equal(blocked.statusCode, 429);
  assert.match(blocked.payload.message, /tentativas/i);
});
