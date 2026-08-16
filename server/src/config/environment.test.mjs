import assert from "node:assert/strict";
import test from "node:test";

import {
  getAgentAutoUpdateInfo,
  getRemoteAssistanceConfig,
  isAllowedVercelOrigin,
  resolveDatabasePoolConfig
} from "./environment.js";

function labEnv(overrides = {}) {
  return {
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    ...overrides
  };
}

test("assistencia remota pode ser habilitada em deploy publico (Vercel) com as flags ligadas, apos a correcao do ACL do agente (commit 9c4e06f)", () => {
  const onVercel = getRemoteAssistanceConfig(labEnv({ VERCEL: "1" }));
  assert.equal(onVercel.enabled, true);
  assert.equal(onVercel.disabledReason, null);

  const vercelProduction = getRemoteAssistanceConfig(labEnv({ VERCEL_ENV: "production" }));
  assert.equal(vercelProduction.enabled, true);
  assert.equal(vercelProduction.disabledReason, null);
});

test("assistencia remota continua desligada em deploy publico se o ambiente nao estiver na lista permitida, mesmo com a flag ligada", () => {
  const onVercel = getRemoteAssistanceConfig({ ENABLE_REMOTE_ASSISTANCE: "true", VERCEL: "1" });
  assert.equal(onVercel.enabled, false);
  assert.equal(onVercel.disabledReason, "environment_not_allowed");
});

test("assistencia remota continua habilitavel fora de deploy publico com as flags de laboratorio", () => {
  const local = getRemoteAssistanceConfig(labEnv());
  assert.equal(local.enabled, true);
  assert.equal(local.disabledReason, null);
});

function autoUpdateEnv(overrides = {}) {
  return {
    AGENT_LATEST_VERSION: "2.0.0",
    AGENT_LATEST_VERSION_URL: "https://cdn.example.com/ITGuardian.exe",
    AGENT_LATEST_VERSION_SHA256: "A".repeat(64),
    ...overrides
  };
}

test("getAgentAutoUpdateInfo retorna a versao quando as tres variaveis estao configuradas corretamente", () => {
  const info = getAgentAutoUpdateInfo(autoUpdateEnv());
  assert.equal(info.version, "2.0.0");
  assert.equal(info.downloadUrl, "https://cdn.example.com/ITGuardian.exe");
  assert.equal(info.sha256, "a".repeat(64), "hash deve ser normalizado para minusculo");
});

test("getAgentAutoUpdateInfo fica inativo se qualquer uma das tres variaveis faltar", () => {
  assert.equal(getAgentAutoUpdateInfo(autoUpdateEnv({ AGENT_LATEST_VERSION: "" })).version, null);
  assert.equal(getAgentAutoUpdateInfo(autoUpdateEnv({ AGENT_LATEST_VERSION_URL: "" })).version, null);
  assert.equal(getAgentAutoUpdateInfo(autoUpdateEnv({ AGENT_LATEST_VERSION_SHA256: "" })).version, null);
  assert.equal(getAgentAutoUpdateInfo({}).version, null);
});

test("getAgentAutoUpdateInfo rejeita URL de download que nao seja https", () => {
  const info = getAgentAutoUpdateInfo(
    autoUpdateEnv({ AGENT_LATEST_VERSION_URL: "http://cdn.example.com/ITGuardian.exe" })
  );
  assert.equal(info.version, null, "download de binario sobre HTTP nao deve ser aceito");

  const malformed = getAgentAutoUpdateInfo(autoUpdateEnv({ AGENT_LATEST_VERSION_URL: "nao-e-uma-url" }));
  assert.equal(malformed.version, null);
});

test("getAgentAutoUpdateInfo rejeita hash que nao seja hexadecimal de 64 caracteres", () => {
  assert.equal(getAgentAutoUpdateInfo(autoUpdateEnv({ AGENT_LATEST_VERSION_SHA256: "abc123" })).version, null);
  assert.equal(
    getAgentAutoUpdateInfo(autoUpdateEnv({ AGENT_LATEST_VERSION_SHA256: "g".repeat(64) })).version,
    null,
    "'g' nao e um digito hexadecimal valido"
  );
});

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
