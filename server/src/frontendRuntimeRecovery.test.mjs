import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isDynamicImportFailure,
  shouldAttemptAssetRecovery
} from "../../client/src/runtimeRecovery.js";

test("reconhece falhas de chunks dinamicos sem confundir erros comuns", () => {
  assert.equal(
    isDynamicImportFailure(new TypeError("Failed to fetch dynamically imported module: /assets/view.js")),
    true
  );
  assert.equal(isDynamicImportFailure(new Error("ChunkLoadError: Loading chunk 42 failed")), true);
  assert.equal(isDynamicImportFailure(new Error("Falha de validacao")), false);
});

test("recuperacao automatica nao entra em loop", () => {
  const now = 100_000;
  assert.equal(shouldAttemptAssetRecovery(null, now), true);
  assert.equal(shouldAttemptAssetRecovery(String(now - 1_000), now), false);
  assert.equal(shouldAttemptAssetRecovery(String(now - 31_000), now), true);
});

test("Vercel nao guarda o shell da SPA e mantem assets versionados imutaveis", async () => {
  const config = JSON.parse(
    await readFile(new URL("../../vercel.json", import.meta.url), "utf8")
  );
  const headers = new Map(
    config.headers.map((entry) => [
      entry.source,
      new Map(entry.headers.map((header) => [header.key.toLowerCase(), header.value]))
    ])
  );

  assert.equal(
    headers.get("/assets/(.*)")?.get("cache-control"),
    "public, max-age=31536000, immutable"
  );
  assert.equal(
    headers.get("/((?!api/|assets/).*)")?.get("cache-control"),
    "no-store, no-cache, must-revalidate"
  );
});
