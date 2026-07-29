import assert from "node:assert/strict";
import test from "node:test";

import { resolveDatabasePoolConfig } from "./environment.js";

test("uses a single short-lived database connection in serverless environments", () => {
  assert.deepEqual(
    resolveDatabasePoolConfig({ env: {}, serverless: true }),
    {
      max: 1,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 5000,
      allowExitOnIdle: true
    }
  );
});

test("keeps the traditional server pool defaults outside serverless environments", () => {
  assert.deepEqual(
    resolveDatabasePoolConfig({ env: {}, serverless: false }),
    {
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false
    }
  );
});

test("caps explicit database pool limits in serverless environments", () => {
  assert.deepEqual(
    resolveDatabasePoolConfig({
      env: {
        DB_POOL_MAX: "3",
        DB_CONNECTION_TIMEOUT_MS: "2500",
        DB_IDLE_TIMEOUT_MS: "7000"
      },
      serverless: true
    }),
    {
      max: 1,
      connectionTimeoutMillis: 2500,
      idleTimeoutMillis: 7000,
      allowExitOnIdle: true
    }
  );
});

test("honors explicit database pool limits outside serverless environments", () => {
  assert.equal(
    resolveDatabasePoolConfig({
      env: { DB_POOL_MAX: "3" },
      serverless: false
    }).max,
    3
  );
});
