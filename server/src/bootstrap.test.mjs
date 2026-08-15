import assert from "node:assert/strict";
import test from "node:test";
import { shouldWarnAboutMissingRedis } from "./bootstrap.js";

test("so alerta sobre Redis ausente quando o deploy e serverless e nao ha configuracao", () => {
  assert.equal(shouldWarnAboutMissingRedis(true, null), true);
  assert.equal(shouldWarnAboutMissingRedis(true, { url: "https://x", token: "y" }), false);
  assert.equal(shouldWarnAboutMissingRedis(false, null), false);
  assert.equal(shouldWarnAboutMissingRedis(false, { url: "https://x", token: "y" }), false);
});
