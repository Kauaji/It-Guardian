import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
const isRealPostgres = Boolean(process.env.TEST_PG_ADMIN_URL);
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "maintenance-script-suggestion-flow-secret-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { refreshDueScriptValidations } = await import("../src/services/maintenanceScripts/maintenanceScriptsFacade.js");
const {
  bearerHeaders,
  bearerUser,
  browserHeaders,
  createScriptViaApi,
  createSuggestionForMachine,
  enrollAndHeartbeat,
  listen,
  login
} = await import("../test-support/scriptFixtures.mjs");

test.after(closeDatabase);

async function startServer(t) {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  return { baseUrl, cookie };
}

function useScript(baseUrl, headers, suggestionId, scriptId, body) {
  return fetch(`${baseUrl}/api/service-order-suggestions/${suggestionId}/scripts/${scriptId}/use`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

test("recomendacao para a sugestao ordena por aderencia ao aviso e ignora scripts inativos", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const machineId = "suggestion-recommendation-machine";
  await enrollAndHeartbeat(baseUrl, machineId);
  const suggestion = await createSuggestionForMachine(baseUrl, cookie, machineId, "suggestion-recommendation-alert");

  const diskScript = await createScriptViaApi(baseUrl, cookie, {
    name: "Verificar saude do disco",
    type: "powershell",
    content: "Get-PhysicalDisk",
    riskLevel: "low",
    category: "Armazenamento",
    alertType: "disk_health_low",
    relatedAlertTypes: ["disk_health_low"],
    tags: ["disco"],
    requiresAdmin: true,
    requiresLoggedUser: true
  });
  const riskyDisk = await createScriptViaApi(baseUrl, cookie, {
    name: "Limpar disco agressivamente",
    type: "powershell",
    content: "Remove-Item C:\\Temp -Recurse",
    riskLevel: "critical",
    relatedAlertTypes: ["disk_health_low"],
    tags: ["disco"]
  });
  const unrelated = await createScriptViaApi(baseUrl, cookie, {
    name: "Relatorio de impressoras",
    type: "powershell",
    content: "Get-Printer",
    riskLevel: "low",
    category: "Impressora"
  });
  const inactive = await createScriptViaApi(baseUrl, cookie, {
    name: "Disco inativo",
    type: "powershell",
    content: "Get-Disk",
    riskLevel: "low",
    relatedAlertTypes: ["disk_health_low"],
    tags: ["disco"],
    active: false
  });

  const response = await fetch(`${baseUrl}/api/service-order-suggestions/${suggestion.id}/recommended-scripts`, {
    headers: { cookie }
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));

  const recommendedIds = body.recommended.map((item) => item.id);
  assert.ok(recommendedIds.includes(diskScript.id), "script aderente ao aviso e recomendado");
  assert.ok(recommendedIds.includes(riskyDisk.id));
  assert.ok(
    recommendedIds.indexOf(diskScript.id) < recommendedIds.indexOf(riskyDisk.id),
    "risco elevado perde pontos e fica atras do equivalente seguro"
  );
  const diskItem = body.recommended.find((item) => item.id === diskScript.id);
  assert.ok(diskItem.recommendationScore > 0);
  assert.match(diskItem.recommendationReason, /^Recomendado por /);
  assert.equal(diskItem.requiresAdmin, true);
  assert.equal(diskItem.requiresLoggedUser, true);
  assert.equal(diskItem.isRecommended, true);
  assert.equal(diskItem.matchedAssetIds.length, 0, "a recomendacao por sugestao nao informa ativos casados");
  assert.deepEqual(diskItem.compatibilityWarnings, [
    "Pode exigir permissão administrativa em execução futura.",
    "Pode exigir usuário logado no ativo em execução futura."
  ]);
  const riskyItem = body.recommended.find((item) => item.id === riskyDisk.id);
  assert.ok(riskyItem.compatibilityWarnings.includes("Script de risco elevado: revisar antes de usar."));

  const otherIds = body.others.map((item) => item.id);
  assert.ok(otherIds.includes(unrelated.id), "script sem relacao com o aviso aparece em 'others'");
  assert.ok(![...recommendedIds, ...otherIds].includes(inactive.id), "script inativo nunca e recomendado");

  const missing = await fetch(`${baseUrl}/api/service-order-suggestions/nao-existe/recommended-scripts`, {
    headers: { cookie }
  });
  assert.equal(missing.status, 404);
});

test("uso de script em sugestao valida pre-condicoes antes de enfileirar", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const machineId = "suggestion-preconditions-machine";
  await enrollAndHeartbeat(baseUrl, machineId);
  const suggestion = await createSuggestionForMachine(baseUrl, cookie, machineId, "suggestion-preconditions-alert");
  const lowScript = await createScriptViaApi(baseUrl, cookie, {
    name: "Diagnostico simples",
    type: "powershell",
    content: "Get-Service",
    riskLevel: "low"
  });
  const highScript = await createScriptViaApi(baseUrl, cookie, {
    name: "Reinicio de servico",
    type: "powershell",
    content: "Restart-Service Spooler",
    riskLevel: "high"
  });
  const headers = browserHeaders(cookie);

  const unknownSuggestion = await useScript(baseUrl, headers, "sugestao-inexistente", lowScript.id, { confirmed: true });
  assert.equal(unknownSuggestion.status, 404);

  const unknownScript = await useScript(baseUrl, headers, suggestion.id, "script-inexistente", { confirmed: true });
  assert.equal(unknownScript.status, 404);

  const unconfirmed = await useScript(baseUrl, headers, suggestion.id, lowScript.id, {});
  assert.equal(unconfirmed.status, 400);
  assert.match((await unconfirmed.json()).message, /Confirme o envio/);

  const { token: approverToken } = await bearerUser({ role: "operator", permissions: ["scripts.approve_high_risk"] });
  const missingAck = await useScript(baseUrl, bearerHeaders(approverToken), suggestion.id, highScript.id, { confirmed: true });
  assert.equal(missingAck.status, 400);
  assert.match((await missingAck.json()).message, /alto risco exigem confirmação extra/);

  const { token: operatorToken } = await bearerUser({ role: "operator", permissions: [] });
  const withoutApproval = await useScript(baseUrl, bearerHeaders(operatorToken), suggestion.id, highScript.id, {
    confirmed: true,
    riskAcknowledged: true
  });
  assert.equal(withoutApproval.status, 403);
  assert.match((await withoutApproval.json()).message, /exigem um revisor com permissão de aprovação/);

  for (const status of ["accepted", "rejected"]) {
    await query("UPDATE service_order_suggestions SET status = $2 WHERE id = $1", [suggestion.id, status]);
    const blocked = await useScript(baseUrl, headers, suggestion.id, lowScript.id, { confirmed: true });
    assert.equal(blocked.status, 409, `sugestao ${status} nao aceita script`);
  }
  await query("UPDATE service_order_suggestions SET status = 'pending' WHERE id = $1", [suggestion.id]);

  await fetch(`${baseUrl}/api/maintenance-scripts/${lowScript.id}`, { method: "DELETE", headers });
  const inactiveScript = await useScript(baseUrl, headers, suggestion.id, lowScript.id, { confirmed: true });
  assert.equal(inactiveScript.status, 404);

  const jobs = await query("SELECT COUNT(*)::INTEGER AS total FROM agent_script_jobs WHERE asset_id = $1", [machineId]);
  assert.equal(jobs.rows[0].total, 0, "nenhuma recusa pode deixar trabalho na fila");
});

test("uso de script em sugestao enfileira com janela limitada, e reenvio e idempotente", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const machineId = "suggestion-queue-machine";
  await enrollAndHeartbeat(baseUrl, machineId);
  const suggestion = await createSuggestionForMachine(baseUrl, cookie, machineId, "suggestion-queue-alert");
  const script = await createScriptViaApi(baseUrl, cookie, {
    name: "Coleta de servicos",
    type: "powershell",
    content: "Get-Service",
    riskLevel: "low"
  });
  const headers = browserHeaders(cookie);

  const first = await useScript(baseUrl, headers, suggestion.id, script.id, {
    confirmed: true,
    validationWindowMinutes: 100000,
    timeoutSeconds: 5000,
    notes: "N".repeat(1500)
  });
  const firstBody = await first.json();
  assert.equal(first.status, 201, JSON.stringify(firstBody));
  assert.equal(firstBody.reused, undefined);
  assert.equal(firstBody.validation.status, "waiting_agent");
  assert.equal(firstBody.validation.validationWindowMinutes, 10080, "janela de observacao limitada a 7 dias");
  assert.equal(firstBody.validation.activeKey, `${suggestion.id}:${script.id}`);
  assert.equal(firstBody.validation.observationSlot, `${suggestion.id}:${script.id}:active`);
  assert.equal(firstBody.validation.assetId, machineId);
  assert.equal(firstBody.log.status, "queued");
  assert.equal(firstBody.log.mode, "agent");
  assert.equal(firstBody.log.notes.length, 1000);
  assert.equal(firstBody.log.suggestionId, suggestion.id);
  assert.equal(firstBody.job.timeoutSeconds, 600, "timeout limitado a 600s");
  assert.equal(firstBody.job.content, "Get-Service");

  const second = await useScript(baseUrl, headers, suggestion.id, script.id, { confirmed: true });
  const secondBody = await second.json();
  assert.equal(second.status, 201);
  assert.equal(secondBody.reused, true);
  assert.equal(secondBody.validation.id, firstBody.validation.id);
  assert.equal(secondBody.log.id, firstBody.log.id);
  assert.equal(secondBody.job, undefined);

  const jobs = await query("SELECT COUNT(*)::INTEGER AS total FROM agent_script_jobs WHERE asset_id = $1", [machineId]);
  assert.equal(jobs.rows[0].total, 1);
  const history = await query(
    "SELECT new_value FROM asset_history WHERE asset_id = $1 AND event_type = 'script_execution_queued'",
    [machineId]
  );
  assert.equal(history.rowCount, 1);
  assert.equal(JSON.parse(history.rows[0].new_value).jobId, firstBody.job.id);
  const audit = await query("SELECT meta FROM audit_logs WHERE type = 'agent_script_execution_queued'");
  assert.ok(audit.rows.some((row) => row.meta.validationId === firstBody.validation.id));

  const validations = await fetch(`${baseUrl}/api/service-order-suggestions/${suggestion.id}/script-validations`, {
    headers: { cookie }
  });
  const validationsBody = await validations.json();
  assert.equal(validations.status, 200);
  assert.equal(validationsBody.validations.length, 1);
  assert.equal(validationsBody.validations[0].scriptName, "Coleta de servicos");
  assert.equal(validationsBody.validations[0].logId, firstBody.log.id);

  const lowWindow = await createSuggestionForMachine(baseUrl, cookie, machineId, "suggestion-queue-alert-low-window");
  const lowWindowResponse = await useScript(baseUrl, headers, lowWindow.id, script.id, {
    confirmed: true,
    validationWindowMinutes: 1
  });
  assert.equal((await lowWindowResponse.json()).validation.validationWindowMinutes, 5, "janela minima de 5 minutos");
});

// O pg-mem nao serializa transacoes concorrentes (sem bloqueio de linha nem
// visibilidade de indice unico entre conexoes); a garantia vem do indice
// unico de active_key + ON CONFLICT DO NOTHING e so e observavel no PostgreSQL real.
test("envios simultaneos do mesmo script para a mesma sugestao criam um unico trabalho", {
  skip: !isRealPostgres && "requer PostgreSQL real (TEST_PG_ADMIN_URL)"
}, async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const machineId = "suggestion-race-machine";
  await enrollAndHeartbeat(baseUrl, machineId);
  const suggestion = await createSuggestionForMachine(baseUrl, cookie, machineId, "suggestion-race-alert");
  const script = await createScriptViaApi(baseUrl, cookie, {
    name: "Script concorrente",
    type: "powershell",
    content: "Get-Process",
    riskLevel: "low"
  });

  const responses = await Promise.all(
    [1, 2, 3].map(() => useScript(baseUrl, browserHeaders(cookie), suggestion.id, script.id, { confirmed: true }))
  );
  const bodies = await Promise.all(responses.map((response) => response.json()));
  assert.ok(responses.every((response) => response.status === 201), JSON.stringify(bodies));
  assert.equal(bodies.filter((body) => !body.reused).length, 1, "exatamente uma chamada enfileira");
  assert.equal(new Set(bodies.map((body) => body.validation.id)).size, 1);

  const jobs = await query("SELECT COUNT(*)::INTEGER AS total FROM agent_script_jobs WHERE asset_id = $1", [machineId]);
  assert.equal(jobs.rows[0].total, 1);
  const comments = await query("SELECT COUNT(*)::INTEGER AS total FROM alert_comments WHERE alert_id = $1", [
    "suggestion-race-alert"
  ]);
  assert.equal(comments.rows[0].total, 1, "somente o envio que enfileirou comenta no aviso");
});

test("cancelar a observacao libera nova tentativa e atualiza a sugestao", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const machineId = "suggestion-cancel-machine";
  await enrollAndHeartbeat(baseUrl, machineId);
  const suggestion = await createSuggestionForMachine(baseUrl, cookie, machineId, "suggestion-cancel-alert");
  const script = await createScriptViaApi(baseUrl, cookie, {
    name: "Script cancelavel",
    type: "powershell",
    content: "Get-Process",
    riskLevel: "low"
  });
  const headers = browserHeaders(cookie);

  const queued = await (await useScript(baseUrl, headers, suggestion.id, script.id, { confirmed: true })).json();
  const cancel = await fetch(`${baseUrl}/api/script-validations/${queued.validation.id}/cancel`, {
    method: "POST",
    headers
  });
  const cancelBody = await cancel.json();
  assert.equal(cancel.status, 200, JSON.stringify(cancelBody));
  assert.equal(cancelBody.validation.status, "validation_cancelled");
  assert.equal(cancelBody.validation.activeKey, null);
  assert.equal(cancelBody.validation.resultSummary, "Observação cancelada manualmente.");

  const suggestionRow = await query(
    "SELECT status, observation_status, last_validation_id FROM service_order_suggestions WHERE id = $1",
    [suggestion.id]
  );
  assert.equal(suggestionRow.rows[0].observation_status, "validation_cancelled");
  assert.equal(suggestionRow.rows[0].last_validation_id, queued.validation.id);
  const history = await query(
    "SELECT old_value, new_value FROM asset_history WHERE asset_id = $1 AND event_type = 'script_validation_cancelled'",
    [machineId]
  );
  assert.equal(history.rowCount, 1);
  assert.equal(history.rows[0].new_value, "validation_cancelled");

  const cancelAgain = await fetch(`${baseUrl}/api/script-validations/${queued.validation.id}/cancel`, {
    method: "POST",
    headers
  });
  assert.equal(cancelAgain.status, 404, "observacao ja finalizada nao pode ser cancelada de novo");
  const cancelMissing = await fetch(`${baseUrl}/api/script-validations/inexistente/cancel`, { method: "POST", headers });
  assert.equal(cancelMissing.status, 404);

  const retry = await useScript(baseUrl, headers, suggestion.id, script.id, { confirmed: true });
  const retryBody = await retry.json();
  assert.equal(retry.status, 201, JSON.stringify(retryBody));
  assert.equal(retryBody.reused, undefined, "apos cancelar, um novo envio cria nova observacao");
  assert.notEqual(retryBody.validation.id, queued.validation.id);
});

test("observacoes vencidas sao encerradas conforme o estado do aviso", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const headers = browserHeaders(cookie);
  const script = await createScriptViaApi(baseUrl, cookie, {
    name: "Script observado",
    type: "powershell",
    content: "Get-Process",
    riskLevel: "low"
  });

  const scenarios = [
    { machineId: "due-resolved-machine", alertId: "due-resolved-alert", expected: "observed_resolved" },
    { machineId: "due-persistent-machine", alertId: "due-persistent-alert", expected: "observed_persistent" },
    { machineId: "due-nodata-machine", alertId: "due-nodata-alert", expected: "insufficient_data" }
  ];
  const validations = [];
  for (const scenario of scenarios) {
    await enrollAndHeartbeat(baseUrl, scenario.machineId);
  }
  for (const scenario of scenarios) {
    const suggestion = await createSuggestionForMachine(baseUrl, cookie, scenario.machineId, scenario.alertId);
    const queued = await (await useScript(baseUrl, headers, suggestion.id, script.id, { confirmed: true })).json();
    validations.push({ ...scenario, suggestionId: suggestion.id, validationId: queued.validation.id });
  }

  await query("UPDATE alerts SET status = 'resolved' WHERE id = 'due-resolved-alert'");
  await query("UPDATE script_validation_runs SET alert_id = NULL WHERE id = $1", [validations[2].validationId]);
  const pastDue = new Date(Date.now() - 60_000).toISOString();
  for (const item of validations) {
    await query("UPDATE script_validation_runs SET validation_due_at = $2 WHERE id = $1", [item.validationId, pastDue]);
  }

  const summary = await refreshDueScriptValidations({ summary: true });
  assert.equal(summary.dueCount, 3);
  assert.equal(summary.updatedCount, 3);
  assert.equal(summary.resolvedCount, 1);
  assert.equal(summary.persistentCount, 1);
  assert.equal(summary.insufficientDataCount, 1);
  assert.equal(summary.failedValidationCount, 0);
  assert.equal(summary.validations.length, 3);

  for (const item of validations) {
    const row = await query(
      "SELECT status, active_key, finished_at, result_summary FROM script_validation_runs WHERE id = $1",
      [item.validationId]
    );
    assert.equal(row.rows[0].status, item.expected);
    assert.equal(row.rows[0].active_key, null);
    assert.ok(row.rows[0].finished_at);
    const suggestionRow = await query(
      "SELECT observation_status, last_validation_id FROM service_order_suggestions WHERE id = $1",
      [item.suggestionId]
    );
    assert.equal(suggestionRow.rows[0].observation_status, item.expected);
    assert.equal(suggestionRow.rows[0].last_validation_id, item.validationId);
    const history = await query(
      "SELECT new_value FROM asset_history WHERE asset_id = $1 AND event_type = 'script_observation_finished'",
      [item.machineId]
    );
    assert.equal(history.rowCount, 1);
    assert.equal(history.rows[0].new_value, item.expected);
  }

  const noMoreDue = await refreshDueScriptValidations();
  assert.deepEqual(noMoreDue, [], "sem observacoes vencidas a funcao devolve lista vazia");
  const noMoreSummary = await refreshDueScriptValidations({ summary: true });
  assert.equal(noMoreSummary.dueCount, 0);
});
