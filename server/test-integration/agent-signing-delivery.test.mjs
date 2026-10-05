import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "agent-signing-delivery-secret-with-32-characters";
process.env.NODE_ENV = "test";

const { generateSigningKeyPair, buildJobMessage, buildUpdateMessage, sha256Hex, signUpdateManifest, verifyMessage } =
  await import("../src/security/agentSigning.js");
const jobKeys = generateSigningKeyPair();
const releaseKeys = generateSigningKeyPair();
process.env.AGENT_JOB_SIGNING_PRIVATE_KEY = jobKeys.privateKeyPem;

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");
const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");
const { queueAgentScriptJob } = await import("../src/services/agentScriptJobService.js");
const { createMaintenanceScript, createScriptSimulationLog } = await import("../src/services/maintenanceScripts/maintenanceScriptsFacade.js");
const { listen, sendHeartbeat } = await import("../test-support/scriptFixtures.mjs");

test.after(closeDatabase);

async function setup(t) {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const enrollment = await createAgentEnrollment({ name: "Agente assinado" });
  const machineId = `signed-${Date.now()}`;
  await sendHeartbeat(baseUrl, enrollment.token, machineId);
  return { baseUrl, token: enrollment.token, machineId };
}

test("job entregue no heartbeat vem assinado e a assinatura amarra job, ativo e conteudo", async (t) => {
  const { baseUrl, token, machineId } = await setup(t);
  const script = await createMaintenanceScript({ name: "Script assinado", type: "powershell", content: "Write-Output 'ok'", riskLevel: "low" });
  const log = await createScriptSimulationLog({ scriptId: script.id, assetId: machineId, mode: "agent", status: "queued", rawLog: "x", parsedSummary: "y" });
  await queueAgentScriptJob({ script, assetId: machineId, executionLogId: log.id });

  const { job } = (await sendHeartbeat(baseUrl, token, machineId)).body;
  assert.ok(job, "job entregue");
  assert.ok(job.signature && job.notAfter);

  const message = (overrides = {}) =>
    buildJobMessage({
      jobId: job.id,
      assetId: machineId,
      interpreter: job.type,
      timeoutSeconds: job.timeoutSeconds,
      contentSha256: sha256Hex(job.content),
      notAfter: job.notAfter,
      ...overrides
    });
  assert.equal(verifyMessage(jobKeys.publicKeyBase64, message(), job.signature), true);
  assert.equal(verifyMessage(jobKeys.publicKeyBase64, message({ assetId: "outra-maquina" }), job.signature), false);
  assert.equal(verifyMessage(jobKeys.publicKeyBase64, message({ contentSha256: sha256Hex("Remove-Item *") }), job.signature), false);
  assert.ok(job.notAfter * 1000 > Date.now() && job.notAfter * 1000 <= Date.now() + 16 * 60 * 1000);
});

test("atualizacao so e oferecida com assinatura valida", async (t) => {
  const { baseUrl, token, machineId } = await setup(t);
  const manifest = { version: "99.0.0", sha256: "c".repeat(64), url: "https://exemplo.local/ITGuardian.exe" };
  Object.assign(process.env, {
    AGENT_LATEST_VERSION: manifest.version,
    AGENT_LATEST_VERSION_URL: manifest.url,
    AGENT_LATEST_VERSION_SHA256: manifest.sha256
  });
  t.after(() => {
    for (const key of ["AGENT_LATEST_VERSION", "AGENT_LATEST_VERSION_URL", "AGENT_LATEST_VERSION_SHA256", "AGENT_LATEST_VERSION_SIGNATURE", "AGENT_RELEASE_PUBLIC_KEY"]) {
      delete process.env[key];
    }
  });
  const heartbeat = async () => (await sendHeartbeat(baseUrl, token, machineId)).body;

  delete process.env.AGENT_LATEST_VERSION_SIGNATURE;
  assert.equal((await heartbeat()).latestVersion, null, "sem assinatura nao oferece");

  process.env.AGENT_LATEST_VERSION_SIGNATURE = signUpdateManifest(releaseKeys.privateKeyPem, manifest);
  const offered = await heartbeat();
  assert.equal(offered.latestVersion, "99.0.0");
  assert.equal(verifyMessage(releaseKeys.publicKeyBase64, buildUpdateMessage({ version: offered.latestVersion, sha256: offered.latestVersionSha256, url: offered.latestVersionDownloadUrl }), offered.latestVersionSignature), true);

  process.env.AGENT_RELEASE_PUBLIC_KEY = generateSigningKeyPair().publicKeyBase64;
  assert.equal((await heartbeat()).latestVersion, null, "com chave publica de release configurada, assinatura de outra chave e barrada no servidor");
  process.env.AGENT_RELEASE_PUBLIC_KEY = releaseKeys.publicKeyBase64;
  assert.equal((await heartbeat()).latestVersion, "99.0.0");
});
