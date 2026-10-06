import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
const isRealPostgres = Boolean(process.env.TEST_PG_ADMIN_URL);
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "maintenance-script-service-order-usage-secret-32chars";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { revokeAgentEnrollment } = await import("../src/repositories/agentRepository.js");
const { bearerHeaders, bearerUser, browserHeaders, createScriptViaApi, createServiceOrderViaApi, enrollAndHeartbeat, listen, login } =
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

function useForOrder(baseUrl, headers, orderId, scriptId, body) {
  return fetch(`${baseUrl}/api/service-orders/${orderId}/scripts/${scriptId}/use`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

test("OS recusa execucao quando faltam ordem, script, confirmacao, confirmacao extra ou agente ativo", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const headers = browserHeaders(cookie);
  const machineId = "so-usage-preconditions";
  const enrollment = await enrollAndHeartbeat(baseUrl, machineId);
  const order = await createServiceOrderViaApi(baseUrl, cookie, { title: "OS de pre-condicoes", assetId: machineId });
  const lowScript = await createScriptViaApi(baseUrl, cookie, {
    name: "Diagnostico simples da OS",
    type: "powershell",
    content: "Get-Service",
    riskLevel: "low"
  });
  const highScript = await createScriptViaApi(baseUrl, cookie, {
    name: "Reinicio de servico da OS",
    type: "powershell",
    content: "Restart-Service Spooler",
    riskLevel: "high"
  });
  const sharedScript = await createScriptViaApi(baseUrl, cookie, {
    name: "Script shell nao executavel",
    type: "shell",
    content: "uname -a",
    riskLevel: "low"
  });

  assert.equal((await useForOrder(baseUrl, headers, "os-inexistente", lowScript.id, { confirmed: true })).status, 404);
  assert.equal((await useForOrder(baseUrl, headers, order.id, "script-inexistente", { confirmed: true })).status, 404);

  const unconfirmed = await useForOrder(baseUrl, headers, order.id, lowScript.id, {});
  assert.equal(unconfirmed.status, 400);
  assert.match((await unconfirmed.json()).message, /Confirme o envio/);

  const { token: approverToken } = await bearerUser({ role: "operator", permissions: ["scripts.approve_high_risk"] });
  const missingAck = await useForOrder(baseUrl, bearerHeaders(approverToken), order.id, highScript.id, { confirmed: true });
  assert.equal(missingAck.status, 400);
  assert.match((await missingAck.json()).message, /alto risco exigem confirmação extra/);

  const notExecutable = await useForOrder(baseUrl, headers, order.id, sharedScript.id, { confirmed: true });
  assert.equal(notExecutable.status, 400, "somente BAT, CMD e PowerShell podem ser enviados ao agente");

  await fetch(`${baseUrl}/api/maintenance-scripts/${lowScript.id}`, { method: "DELETE", headers });
  assert.equal((await useForOrder(baseUrl, headers, order.id, lowScript.id, { confirmed: true })).status, 404);

  const activeScript = await createScriptViaApi(baseUrl, cookie, {
    name: "Script com agente revogado",
    type: "cmd",
    content: "hostname",
    riskLevel: "low"
  });
  await revokeAgentEnrollment(enrollment.enrollment.id);
  const withoutAgent = await useForOrder(baseUrl, headers, order.id, activeScript.id, { confirmed: true });
  assert.equal(withoutAgent.status, 409, "agente revogado nao recebe trabalhos");
  assert.match((await withoutAgent.json()).message, /nao possui um agente ativo/);

  const queued = await query("SELECT COUNT(*)::INTEGER AS total FROM agent_script_jobs WHERE asset_id = $1", [machineId]);
  assert.equal(queued.rows[0].total, 0);
  if (isRealPostgres) {
    // O pg-mem nao desfaz as escritas de uma transacao revertida; so o PostgreSQL real garante o ROLLBACK.
    const orphanLogs = await query(
      "SELECT COUNT(*)::INTEGER AS total FROM script_execution_logs WHERE service_order_id = $1 AND mode = 'agent'",
      [order.id]
    );
    assert.equal(orphanLogs.rows[0].total, 0, "a recusa reverte o log de execucao criado na mesma transacao");
  }
});

test("OS enfileira script com timeout limitado, grava historicos e lista a atividade", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const headers = browserHeaders(cookie);
  const machineId = "so-usage-queue";
  await enrollAndHeartbeat(baseUrl, machineId);
  const order = await createServiceOrderViaApi(baseUrl, cookie, { title: "OS para enfileirar", assetId: machineId });
  const script = await createScriptViaApi(baseUrl, cookie, {
    name: "Diagnostico enfileirado pela OS",
    type: "bat",
    content: "ipconfig /all",
    riskLevel: "low"
  });

  const emptyActivity = await (
    await fetch(`${baseUrl}/api/service-orders/${order.id}/script-activity`, {
      headers: { cookie }
    })
  ).json();
  assert.deepEqual(emptyActivity.activity, []);

  await fetch(`${baseUrl}/api/maintenance-scripts/${script.id}/register-simulation`, {
    method: "POST",
    headers,
    body: JSON.stringify({ confirmed: true, serviceOrderId: order.id })
  });

  const response = await useForOrder(baseUrl, headers, order.id, script.id, {
    confirmed: true,
    timeoutSeconds: 1,
    notes: "Executar na janela de manutencao"
  });
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.job.timeoutSeconds, 15, "timeout minimo de 15 segundos");
  assert.equal(body.job.type, "bat");
  assert.equal(body.log.status, "queued");
  assert.equal(body.log.mode, "agent");
  assert.equal(body.log.serviceOrderId, order.id);
  assert.equal(body.log.assetId, machineId);
  assert.equal(body.log.notes, "Executar na janela de manutencao");
  assert.equal(body.serviceOrder.id, order.id);
  assert.equal(body.validation, undefined, "o fluxo da OS nao usa observacao de aviso");

  const jobRow = await query(
    "SELECT status, validation_id, automation_run_id, requested_by, content_hash FROM agent_script_jobs WHERE id = $1",
    [body.job.id]
  );
  assert.equal(jobRow.rows[0].status, "queued");
  assert.equal(jobRow.rows[0].validation_id, null);
  assert.equal(jobRow.rows[0].automation_run_id, null);
  assert.match(jobRow.rows[0].content_hash, /^[0-9a-f]{64}$/);
  assert.ok(jobRow.rows[0].requested_by);

  const longTimeout = await useForOrder(baseUrl, headers, order.id, script.id, { confirmed: true, timeoutSeconds: 99999 });
  assert.equal((await longTimeout.json()).job.timeoutSeconds, 600, "timeout maximo de 600 segundos");
  const defaultTimeout = await useForOrder(baseUrl, headers, order.id, script.id, { confirmed: true });
  assert.equal((await defaultTimeout.json()).job.timeoutSeconds, 120);

  const orderHistory = await query(
    "SELECT new_value FROM service_order_history WHERE service_order_id = $1 AND event_type = 'script_execution_queued'",
    [order.id]
  );
  assert.equal(orderHistory.rowCount, 3);
  const audit = await query("SELECT meta FROM audit_logs WHERE type = 'agent_script_execution_queued' ORDER BY created_at DESC LIMIT 1");
  assert.equal(audit.rows[0].meta.serviceOrderId, order.id);

  const activity = (
    await (
      await fetch(`${baseUrl}/api/service-orders/${order.id}/script-activity`, {
        headers: { cookie }
      })
    ).json()
  ).activity;
  assert.equal(activity.length, 4, "uma simulacao e tres envios reais");
  assert.equal(activity.filter((item) => item.job === null).length, 1, "a simulacao nao tem trabalho do agente");
  const queuedActivity = activity.find((item) => item.job?.id === body.job.id);
  assert.equal(queuedActivity.job.status, "queued");
  assert.equal(queuedActivity.job.timedOut, false);
  assert.equal(queuedActivity.job.stdout, "");
  assert.equal(queuedActivity.scriptName, "Diagnostico enfileirado pela OS");
});
