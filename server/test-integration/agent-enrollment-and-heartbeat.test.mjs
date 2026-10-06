import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "agent-enrollment-heartbeat-secret-with-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const {
  authenticateAgentToken,
  createAgentEnrollment,
  findAgentAssetByActivationId,
  findAgentAssetByEnrollmentId,
  findAgentAssetById,
  listAgentAssets,
  listAgentEnrollments,
  revokeAgentEnrollment,
  setAgentAssetRustdeskId,
  updateAgentAssetAlias
} = await import("../src/repositories/agentRepository.js");
const { verifyPublicMachineToken } = await import("../src/services/publicMachineToken.js");
const { agentHeaders, bearerHeaders, bearerUser, browserHeaders, heartbeatPayload, listen, login, sendHeartbeat } =
  await import("../test-support/scriptFixtures.mjs");

test.after(closeDatabase);

async function startServer(t) {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  return { baseUrl, cookie };
}

async function createActivation(enrollmentId, { status = "active" } = {}) {
  const productKeyId = randomUUID();
  const activationId = randomUUID();
  await query(
    `
      INSERT INTO product_keys (id, key_hash, key_hint, display_name, organization_name, plan_name, activation_limit)
      VALUES ($1, $2, 'XXXX', 'Chave de teste', 'Organizacao', 'Plano', 10)
    `,
    [productKeyId, `hash-${productKeyId}`]
  );
  await query(
    `
      INSERT INTO device_activations (id, product_key_id, machine_fingerprint, hostname, alias, status)
      VALUES ($1, $2, $3, 'HOST-ORIGINAL', 'Apelido original', $4)
    `,
    [activationId, productKeyId, `fingerprint-${activationId}`, status]
  );
  await query("UPDATE agent_enrollments SET activation_id = $2, product_key_id = $3 WHERE id = $1", [
    enrollmentId,
    activationId,
    productKeyId
  ]);
  return activationId;
}

test("gestao de tokens do agente: criar, listar, revogar e restringir a administradores", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const headers = browserHeaders(cookie);

  const missingName = await fetch(`${baseUrl}/api/agents/enrollments`, { method: "POST", headers, body: JSON.stringify({}) });
  assert.equal(missingName.status, 400);
  const longName = await fetch(`${baseUrl}/api/agents/enrollments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "n".repeat(121) })
  });
  assert.equal(longName.status, 400);

  const created = await fetch(`${baseUrl}/api/agents/enrollments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "  Laboratorio principal  " })
  });
  const createdBody = await created.json();
  assert.equal(created.status, 201, JSON.stringify(createdBody));
  assert.equal(createdBody.enrollment.name, "Laboratorio principal");
  assert.equal(createdBody.enrollment.active, true);
  assert.match(createdBody.token, /^itg_[A-Za-z0-9_-]{40,}$/);
  assert.equal(createdBody.enrollment.tokenPrefix, createdBody.token.slice(0, 12));
  assert.match(createdBody.warning, /exibido apenas uma vez/);
  assert.equal(JSON.stringify(createdBody.enrollment).includes(createdBody.token), false, "o token completo so aparece uma vez");

  const stored = await query("SELECT token_hash FROM agent_enrollments WHERE id = $1", [createdBody.enrollment.id]);
  assert.notEqual(stored.rows[0].token_hash, createdBody.token);
  assert.equal((await authenticateAgentToken(createdBody.token)).id, createdBody.enrollment.id);
  assert.equal(await authenticateAgentToken(""), null);
  assert.equal(await authenticateAgentToken("itg_desconhecido"), null);

  const listed = await (await fetch(`${baseUrl}/api/agents/enrollments`, { headers: { cookie } })).json();
  assert.ok(listed.enrollments.some((item) => item.id === createdBody.enrollment.id));
  assert.ok(!JSON.stringify(listed).includes(createdBody.token));
  assert.equal((await listAgentEnrollments()).length, listed.enrollments.length);

  const revoked = await fetch(`${baseUrl}/api/agents/enrollments/${createdBody.enrollment.id}/revoke`, {
    method: "POST",
    headers
  });
  const revokedBody = await revoked.json();
  assert.equal(revoked.status, 200);
  assert.equal(revokedBody.enrollment.active, false);
  assert.ok(revokedBody.enrollment.revokedAt);
  assert.equal(await authenticateAgentToken(createdBody.token), null, "token revogado nao autentica mais");

  const revokedAgain = await fetch(`${baseUrl}/api/agents/enrollments/${createdBody.enrollment.id}/revoke`, {
    method: "POST",
    headers
  });
  assert.equal(revokedAgain.status, 404);
  assert.match((await revokedAgain.json()).message, /Token ativo nao encontrado/);
  assert.equal(await revokeAgentEnrollment("inexistente"), null);

  const { token: operatorToken } = await bearerUser({ role: "operator" });
  for (const [method, path] of [
    ["GET", "/enrollments"],
    ["POST", "/enrollments"],
    ["POST", "/enrollments/x/revoke"]
  ]) {
    const response = await fetch(`${baseUrl}/api/agents${path}`, {
      method,
      headers: bearerHeaders(operatorToken),
      body: method === "POST" ? JSON.stringify({ name: "Tentativa de operador" }) : undefined
    });
    assert.equal(response.status, 403, `${method} ${path} so para administradores`);
  }
  assert.equal((await fetch(`${baseUrl}/api/agents/enrollments`)).status, 401);
});

test("heartbeat valida o payload do coletor", async (t) => {
  const { baseUrl } = await startServer(t);
  const enrollment = await createAgentEnrollment({ name: "Agente de validacao" });
  const send = async (overrides, expected, label) => {
    const response = await fetch(`${baseUrl}/api/agents/heartbeat`, {
      method: "POST",
      headers: agentHeaders(enrollment.token),
      body: JSON.stringify(heartbeatPayload("heartbeat-validation", overrides))
    });
    assert.equal(response.status, expected, `${label}: ${JSON.stringify(await response.json())}`);
  };

  await send({}, 202, "payload valido");
  await send({ collectedAt: "ontem" }, 400, "data invalida");
  await send({ collectedAt: undefined }, 400, "data ausente");
  await send({ hostname: "" }, 400, "hostname obrigatorio");
  await send({ hostname: "h".repeat(181) }, 400, "hostname longo");
  await send({ machineId: undefined }, 400, "machineId obrigatorio");
  await send({ agentVersion: undefined }, 400, "versao obrigatoria");
  await send({ operatingSystem: undefined }, 400, "sistema obrigatorio");
  await send({ cpuUsagePercent: 101 }, 400, "cpu acima de 100");
  await send({ cpuUsagePercent: -1 }, 400, "cpu negativa");
  await send({ memoryTotalBytes: "muito" }, 400, "memoria nao numerica");
  await send({ intervalSeconds: 10 }, 400, "intervalo abaixo do minimo");
  await send({ intervalSeconds: 90000 }, 400, "intervalo acima do maximo");
  await send({ memoryTotalBytes: 100, memoryUsedBytes: 200 }, 400, "memoria usada acima do total");
  await send({ memoryTotalBytes: 100, memoryFreeBytes: 200 }, 400, "memoria livre acima do total");
  await send({ diskTotalBytes: 100, diskFreeBytes: 200 }, 400, "disco livre acima do total");
  await send({ inventoryDetails: [1, 2] }, 400, "inventario como lista");
  await send({ inventoryDetails: "texto" }, 400, "inventario como texto");
  await send({ unknownField: "x" }, 400, "campo desconhecido");
  await send({ intervalSeconds: undefined, cpuUsagePercent: 55, inventoryDetails: undefined }, 202, "campos opcionais ausentes");

  const asset = await findAgentAssetById("heartbeat-validation");
  assert.equal(asset.intervalSeconds, 300, "intervalo ausente assume 300 segundos");
  assert.deepEqual(asset.inventoryDetails, {});

  const arrayBody = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: agentHeaders(enrollment.token),
    body: JSON.stringify([1, 2])
  });
  assert.equal(arrayBody.status, 400);
});

test("heartbeat registra o agente, a reconexao apos inatividade e sincroniza a ativacao", async (t) => {
  const { baseUrl } = await startServer(t);
  const enrollment = await createAgentEnrollment({ name: "Agente de presenca" });
  const activationId = await createActivation(enrollment.enrollment.id);
  const machineId = "heartbeat-presence";
  const countHistory = async (eventType) =>
    (await query("SELECT COUNT(*)::INTEGER AS total FROM asset_history WHERE asset_id = $1 AND event_type = $2", [machineId, eventType]))
      .rows[0].total;

  const first = await sendHeartbeat(baseUrl, enrollment.token, machineId, {
    machineAlias: "Notebook da recepcao",
    hostname: "RECEPCAO-01",
    agentVersion: "1.2.3"
  });
  assert.equal(first.response.status, 202);
  assert.equal(first.body.assetId, machineId);
  assert.equal(first.body.remoteScriptExecutionEnabled, true);
  assert.equal(first.body.job, null);
  assert.equal(first.body.intervalSeconds, 60);
  assert.ok(Date.parse(first.body.acceptedAt));
  assert.equal(await countHistory("agent_enrolled"), 1);

  const activation = (
    await query("SELECT hostname, alias, collector_version, last_seen_at FROM device_activations WHERE id = $1", [activationId])
  ).rows[0];
  assert.equal(activation.hostname, "RECEPCAO-01");
  assert.equal(activation.alias, "Notebook da recepcao");
  assert.equal(activation.collector_version, "1.2.3");

  await sendHeartbeat(baseUrl, enrollment.token, machineId, { machineAlias: null, hostname: "RECEPCAO-02" });
  assert.equal(await countHistory("agent_enrolled"), 1, "heartbeat recente nao gera novo evento");
  assert.equal(await countHistory("agent_reconnected"), 0);
  const keptAlias = (await query("SELECT hostname, alias FROM device_activations WHERE id = $1", [activationId])).rows[0];
  assert.equal(keptAlias.hostname, "RECEPCAO-02");
  assert.equal(keptAlias.alias, "Notebook da recepcao", "alias nulo no heartbeat preserva o apelido da ativacao");

  const staleAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  await query("UPDATE agent_assets SET last_seen_at = $2 WHERE asset_id = $1", [machineId, staleAt]);
  await sendHeartbeat(baseUrl, enrollment.token, machineId);
  assert.equal(await countHistory("agent_reconnected"), 1, "volta apos 30 minutos de silencio gera reconexao");
  const reconnection = await query(
    "SELECT message, new_value, user_name FROM asset_history WHERE asset_id = $1 AND event_type = 'agent_reconnected'",
    [machineId]
  );
  assert.match(reconnection.rows[0].message, /voltou a comunicar na maquina/);
  assert.equal(reconnection.rows[0].user_name, "Agente IT Guardian");
  assert.equal(JSON.parse(reconnection.rows[0].new_value).enrollmentId, enrollment.enrollment.id);

  const previousSeconds = process.env.AGENT_OFFLINE_AFTER_SECONDS;
  process.env.AGENT_OFFLINE_AFTER_SECONDS = "120";
  try {
    await query("UPDATE agent_assets SET last_seen_at = $2, interval_seconds = 30 WHERE asset_id = $1", [
      machineId,
      new Date(Date.now() - 5 * 60 * 1000).toISOString()
    ]);
    await sendHeartbeat(baseUrl, enrollment.token, machineId);
    assert.equal(await countHistory("agent_reconnected"), 2, "limite configurado em segundos e respeitado");

    await query("UPDATE agent_assets SET last_seen_at = $2, interval_seconds = 120 WHERE asset_id = $1", [
      machineId,
      new Date(Date.now() - 5 * 60 * 1000).toISOString()
    ]);
    await sendHeartbeat(baseUrl, enrollment.token, machineId);
    assert.equal(await countHistory("agent_reconnected"), 2, "o limite cresce com o triplo do intervalo anterior");
  } finally {
    if (previousSeconds == null) delete process.env.AGENT_OFFLINE_AFTER_SECONDS;
    else process.env.AGENT_OFFLINE_AFTER_SECONDS = previousSeconds;
  }

  const asset = await findAgentAssetByActivationId(activationId);
  assert.equal(asset.id, machineId);
  assert.equal((await findAgentAssetByEnrollmentId(enrollment.enrollment.id)).id, machineId);
  assert.equal(await findAgentAssetByActivationId("ativacao-inexistente"), null);
  assert.equal(await findAgentAssetByEnrollmentId("enrollment-inexistente"), null);

  await query("UPDATE device_activations SET status = 'deactivated' WHERE id = $1", [activationId]);
  await sendHeartbeat(baseUrl, enrollment.token, machineId, { hostname: "HOST-DEPOIS-DE-DESATIVAR" });
  const deactivated = (await query("SELECT hostname FROM device_activations WHERE id = $1", [activationId])).rows[0];
  assert.equal(deactivated.hostname, "HEARTBEAT-PRESENCE", "ativacao desativada nao e atualizada pelo heartbeat");
});

test("heartbeat grava amostras de metrica e preserva apelido definido pelo operador", async (t) => {
  const { baseUrl } = await startServer(t);
  const enrollment = await createAgentEnrollment({ name: "Agente de metricas" });
  const activationId = await createActivation(enrollment.enrollment.id);
  const machineId = "heartbeat-metrics";

  await sendHeartbeat(baseUrl, enrollment.token, machineId, { cpuUsagePercent: 42 });
  const samples = await query("SELECT COUNT(*)::INTEGER AS total FROM asset_metric_history WHERE asset_id = $1", [machineId]);
  assert.equal(samples.rows[0].total, 1);

  await sendHeartbeat(baseUrl, enrollment.token, machineId, {
    cpuUsagePercent: undefined,
    memoryTotalBytes: undefined,
    memoryUsedBytes: undefined,
    memoryFreeBytes: undefined,
    diskTotalBytes: undefined,
    diskFreeBytes: undefined
  });
  const withoutMetrics = await query("SELECT COUNT(*)::INTEGER AS total FROM asset_metric_history WHERE asset_id = $1", [machineId]);
  assert.equal(withoutMetrics.rows[0].total, 1, "heartbeat sem metricas nao grava amostra");

  const updated = await updateAgentAssetAlias({ assetId: machineId, alias: "Apelido do operador" });
  assert.equal(updated.machineAlias, "Apelido do operador");
  const activation = (await query("SELECT alias FROM device_activations WHERE id = $1", [activationId])).rows[0];
  assert.equal(activation.alias, "Apelido do operador", "o apelido tambem e gravado na ativacao vinculada");
  assert.equal(await updateAgentAssetAlias({ assetId: "inexistente", alias: "x" }), null);
  const cleared = await updateAgentAssetAlias({ assetId: machineId, alias: "" });
  assert.equal(cleared.machineAlias, null);

  const rustdesk = await setAgentAssetRustdeskId({ assetId: machineId, rustdeskId: `  ${"9".repeat(40)}  ` });
  assert.equal(rustdesk.rustdeskId.length, 32);
  assert.ok(rustdesk.rustdeskIdUpdatedAt);
  const clearedRustdesk = await setAgentAssetRustdeskId({ assetId: machineId, rustdeskId: "   " });
  assert.equal(clearedRustdesk.rustdeskId, null);
  assert.equal(await setAgentAssetRustdeskId({ assetId: "inexistente", rustdeskId: "123" }), null);

  assert.ok((await listAgentAssets()).some((asset) => asset.id === machineId));
  assert.equal(await findAgentAssetById("inexistente"), null);
});

test("heartbeat informa versao mais recente apenas quando o agente esta desatualizado", async (t) => {
  const { baseUrl } = await startServer(t);
  const enrollment = await createAgentEnrollment({ name: "Agente de versao" });
  t.after(() => {
    delete process.env.AGENT_LATEST_VERSION;
    delete process.env.AGENT_LATEST_VERSION_URL;
    delete process.env.AGENT_LATEST_VERSION_SHA256;
    delete process.env.AGENT_LATEST_VERSION_SIGNATURE;
  });
  process.env.AGENT_LATEST_VERSION = "1.10.0";
  process.env.AGENT_LATEST_VERSION_URL = "https://cdn.example.com/ITGuardian.exe";
  process.env.AGENT_LATEST_VERSION_SHA256 = "b".repeat(64);
  process.env.AGENT_LATEST_VERSION_SIGNATURE = (await import("../src/security/agentSigning.js")).signUpdateManifest(
    (await import("../src/security/agentSigning.js")).generateSigningKeyPair().privateKeyPem,
    { version: "1.10.0", sha256: "b".repeat(64), url: "https://cdn.example.com/ITGuardian.exe" }
  );

  const expectations = [
    ["1.9.0", "1.10.0"],
    ["1.10", null],
    ["1.10.0", null],
    ["1.10.0.0", null],
    ["1.10.1", null],
    ["2.0.0", null],
    ["0.0.1", "1.10.0"],
    ["1.x.0", "1.10.0"]
  ];
  for (const [reported, expected] of expectations) {
    const { body } = await sendHeartbeat(baseUrl, enrollment.token, "heartbeat-version", { agentVersion: reported });
    assert.equal(body.latestVersion, expected, `agente ${reported}`);
    assert.equal(body.latestVersionDownloadUrl, expected ? "https://cdn.example.com/ITGuardian.exe" : null);
    assert.equal(body.latestVersionSha256, expected ? "b".repeat(64) : null);
  }
});

test("link de suporte do agente exige token valido e ativacao vinculada", async (t) => {
  const { baseUrl } = await startServer(t);
  const withoutActivation = await createAgentEnrollment({ name: "Agente sem ativacao" });
  const withActivation = await createAgentEnrollment({ name: "Agente com ativacao" });
  const activationId = await createActivation(withActivation.enrollment.id);
  const supportLink = (token) =>
    fetch(`${baseUrl}/api/agents/support-link`, {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    });

  assert.equal((await supportLink()).status, 401);
  assert.equal((await supportLink("itg_token_invalido")).status, 401);
  const noActivation = await supportLink(withoutActivation.token);
  assert.equal(noActivation.status, 409);
  assert.match((await noActivation.json()).message, /nao possui uma ativacao vinculada/);

  const previousPublicUrl = process.env.PUBLIC_APP_URL;
  process.env.PUBLIC_APP_URL = "https://suporte.exemplo.com/";
  try {
    const ok = await supportLink(withActivation.token);
    const body = await ok.json();
    assert.equal(ok.status, 200, JSON.stringify(body));
    const url = new URL(body.supportUrl);
    assert.equal(url.origin, "https://suporte.exemplo.com");
    assert.equal(url.pathname, "/abrir-chamado");
    assert.equal(verifyPublicMachineToken(url.searchParams.get("device")), activationId);
  } finally {
    if (previousPublicUrl == null) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = previousPublicUrl;
  }

  const fallback = await (await supportLink(withActivation.token)).json();
  assert.match(fallback.supportUrl, /\/abrir-chamado\?device=/, "sem PUBLIC_APP_URL usa a URL do frontend");

  await revokeAgentEnrollment(withActivation.enrollment.id);
  assert.equal((await supportLink(withActivation.token)).status, 401, "token revogado nao gera link de suporte");
});

test("rotas do coletor aceitam apenas Bearer valido e os aliases legados", async (t) => {
  const { baseUrl } = await startServer(t);
  const enrollment = await createAgentEnrollment({ name: "Agente de rotas" });
  const body = JSON.stringify(heartbeatPayload("heartbeat-routes"));

  for (const path of ["/api/agents/enroll", "/api/agents/inventory", "/agent/heartbeat"]) {
    const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: agentHeaders(enrollment.token), body });
    assert.equal(response.status, 202, path);
  }
  const lowerCase = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `bearer ${enrollment.token}`, "content-type": "application/json" },
    body
  });
  assert.equal(lowerCase.status, 202, "o esquema Bearer nao diferencia maiusculas");
  const basic = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Basic ${enrollment.token}`, "content-type": "application/json" },
    body
  });
  assert.equal(basic.status, 401);

  await revokeAgentEnrollment(enrollment.enrollment.id);
  const revoked = await fetch(`${baseUrl}/api/agents/heartbeat`, { method: "POST", headers: agentHeaders(enrollment.token), body });
  assert.equal(revoked.status, 401, "agente revogado nao registra inventario");
  const heartbeats = await query("SELECT COUNT(*)::INTEGER AS total FROM agent_heartbeats WHERE asset_id = 'heartbeat-routes'");
  assert.equal(heartbeats.rows[0].total, 4, "somente os heartbeats aceitos ficam registrados");
});
