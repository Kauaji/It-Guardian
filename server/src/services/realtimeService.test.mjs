import assert from "node:assert/strict";
import test from "node:test";
import { isTrustedRealtimeOrigin } from "./realtimeService.js";

test("WebSocket por cookie aceita apenas origens configuradas", () => {
  assert.equal(isTrustedRealtimeOrigin("http://localhost:5173"), true);
  assert.equal(isTrustedRealtimeOrigin("http://127.0.0.1:5173/"), true);
  assert.equal(isTrustedRealtimeOrigin("https://untrusted.example"), false);
  assert.equal(isTrustedRealtimeOrigin(""), false);
});
