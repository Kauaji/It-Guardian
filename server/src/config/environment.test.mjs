import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedVercelOrigin, resolveDatabasePoolConfig } from "./environment.js";

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

test("isAllowedVercelOrigin rejects any origin when not running on Vercel", () => {
  assert.equal(
    isAllowedVercelOrigin("https://it-guardian-server.vercel.app", {}),
    false
  );
});

test("isAllowedVercelOrigin trusts only the project's own production domain", () => {
  const env = { VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: "it-guardian-server.vercel.app" };
  assert.equal(isAllowedVercelOrigin("https://it-guardian-server.vercel.app", env), true);
  assert.equal(isAllowedVercelOrigin("https://outro-projeto-qualquer.vercel.app", env), false);
});

test("isAllowedVercelOrigin no longer trusts an arbitrary third-party *.vercel.app origin", () => {
  const env = { VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: "it-guardian-server.vercel.app" };
  assert.equal(isAllowedVercelOrigin("https://attacker-phishing-page.vercel.app", env), false);
});

test("isAllowedVercelOrigin does not fall for a project name crafted to end with a trusted-looking suffix", () => {
  const env = { VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: "it-guardian-server.vercel.app" };
  assert.equal(
    isAllowedVercelOrigin("https://attacker-project-it-guardian-server.vercel.app", env),
    false
  );
});

test("isAllowedVercelOrigin rejects preview/branch deployments of the same project (no pattern trust)", () => {
  const env = { VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: "it-guardian-server.vercel.app" };
  assert.equal(
    isAllowedVercelOrigin("https://it-guardian-server-git-main-kauajis-projects.vercel.app", env),
    false,
    "preview origins are covered dynamically by getCorsOrigins() via VERCEL_URL/VERCEL_BRANCH_URL, not by this function"
  );
});

test("isAllowedVercelOrigin rejects non-https and malformed origins", () => {
  const env = { VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: "it-guardian-server.vercel.app" };
  assert.equal(isAllowedVercelOrigin("http://it-guardian-server.vercel.app", env), false);
  assert.equal(isAllowedVercelOrigin("not-a-url", env), false);
});
