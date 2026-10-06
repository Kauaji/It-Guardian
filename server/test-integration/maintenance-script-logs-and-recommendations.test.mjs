import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "maintenance-script-logs-recommendations-secret-32chars";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { createScriptSimulationLog, findMaintenanceScriptById, listRecentScriptExecutionLogs } =
  await import("../src/services/maintenanceScripts/maintenanceScriptsFacade.js");
const { browserHeaders, createScriptViaApi, createSuggestionForMachine, enrollAndHeartbeat, listen, login } =
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

const logRules = [
  ["Acesso negado ao abrir C:\\dados", "access_denied", "ACCESS_DENIED", "permissao", "high", true, false],
  ["File not found: C:\\x.txt", "file_not_found", "FILE_NOT_FOUND", "arquivo", "medium", false, false],
  ["invalid path specified", "invalid_path", "INVALID_PATH", "caminho", "medium", false, false],
  ["This operation requires elevation", "insufficient_permission", "INSUFFICIENT_PERMISSION", "permissao", "high", true, false],
  [
    "'foo' is not recognized as an internal command",
    "command_not_recognized",
    "COMMAND_NOT_RECOGNIZED",
    "ambiente",
    "medium",
    false,
    false
  ],
  ["A operacao atingiu o timeout", "timeout", "TIMEOUT", "tempo_limite", "medium", false, false],
  ["Host unreachable", "network_failure", "NETWORK_FAILURE", "rede", "high", false, false],
  ["agent offline", "agent_unavailable", "AGENT_UNAVAILABLE", "agente", "medium", false, false],
  ["valor {{HOSTNAME}} nao substituido", "unresolved_variable", "UNRESOLVED_VARIABLE", "variavel", "medium", false, false],
  ["logged user not detected", "logged_user_not_detected", "LOGGED_USER_NOT_DETECTED", "sessao_usuario", "medium", false, true]
];

test("log de execucao interpreta cada padrao de erro conhecido e respeita valores explicitos", async (t) => {
  await startServer(t);
  const script = await findAnyScript();

  for (const [rawLog, errorType, errorCode, category, severity, requiresAdmin, requiresLoggedUser] of logRules) {
    const log = await createScriptSimulationLog({ scriptId: script.id, rawLog, status: "registered" });
    assert.equal(log.errorDetected, true, rawLog);
    assert.equal(log.errorType, errorType, rawLog);
    assert.equal(log.errorCode, errorCode);
    assert.equal(log.errorCategory, category);
    assert.equal(log.errorSeverity, severity);
    assert.equal(log.requiresAdmin, requiresAdmin);
    assert.equal(log.requiresLoggedUser, requiresLoggedUser);
    assert.equal(log.attentionRequired, true);
    assert.equal(log.status, "error");
    assert.ok(log.probableCause && log.suggestedSolution && log.parsedSummary);
  }

  const clean = await createScriptSimulationLog({ scriptId: script.id, rawLog: "Tudo certo por aqui", status: "error" });
  assert.equal(clean.errorDetected, false);
  assert.equal(clean.status, "registered", "sem erro reconhecido, 'error' volta para 'registered'");
  assert.equal(clean.parsedSummary, "Log registrado sem erro reconhecido.");
  assert.equal(clean.attentionRequired, false);

  const cleanQueued = await createScriptSimulationLog({ scriptId: script.id, rawLog: "ok", status: "queued" });
  assert.equal(cleanQueued.status, "queued");

  const empty = await createScriptSimulationLog({ scriptId: script.id, status: "queued" });
  assert.equal(empty.parsedSummary, "Nenhum log de script disponível.");
  assert.equal(empty.status, "queued");
  assert.equal(empty.rawLog, "");

  const explicit = await createScriptSimulationLog({
    scriptId: script.id,
    rawLog: "Access denied",
    parsedSummary: "Resumo informado",
    errorDetected: false,
    attentionRequired: true,
    errorType: "custom",
    errorCode: "CUSTOM",
    errorCategory: "cat",
    errorSeverity: "low",
    probableCause: "causa",
    suggestedSolution: "solucao",
    requiresAdmin: false,
    requiresLoggedUser: true,
    mode: "modo-invalido",
    notes: "N".repeat(1200)
  });
  assert.equal(explicit.parsedSummary, "Resumo informado");
  assert.equal(explicit.errorDetected, false);
  assert.equal(explicit.attentionRequired, true);
  assert.equal(explicit.errorType, "custom");
  assert.equal(explicit.errorCode, "CUSTOM");
  assert.equal(explicit.errorSeverity, "low");
  assert.equal(explicit.probableCause, "causa");
  assert.equal(explicit.requiresAdmin, false);
  assert.equal(explicit.requiresLoggedUser, true);
  assert.equal(explicit.mode, "simulated");
  assert.equal(explicit.notes.length, 1000);

  const recent = await listRecentScriptExecutionLogs({ limit: 3 });
  assert.equal(recent.length, 3);
  assert.ok(recent.every((item) => item.scriptName));
  const defaultLimit = await listRecentScriptExecutionLogs();
  assert.equal(defaultLimit.length, 10);
});

async function findAnyScript() {
  const row = await query("SELECT id FROM maintenance_scripts ORDER BY id LIMIT 1");
  return findMaintenanceScriptById(row.rows[0].id);
}

test("logs pendentes: listar, consultar, reconhecer e registrar solucao sugerida", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const headers = browserHeaders(cookie);
  const machineId = "script-log-machine";
  await enrollAndHeartbeat(baseUrl, machineId);
  const script = await createScriptViaApi(baseUrl, cookie, {
    name: "Script do log",
    type: "powershell",
    content: "Get-Item C:\\x",
    riskLevel: "low"
  });
  const withAsset = await createScriptSimulationLog({
    scriptId: script.id,
    assetId: machineId,
    rawLog: "Access denied to C:\\x",
    mode: "agent",
    status: "failed"
  });
  const withoutAsset = await createScriptSimulationLog({ scriptId: script.id, rawLog: "timeout ao consultar" });
  const harmless = await createScriptSimulationLog({ scriptId: script.id, rawLog: "sem problemas" });

  const pending = await (await fetch(`${baseUrl}/api/script-logs/pending`, { headers: { cookie } })).json();
  const pendingIds = pending.logs.map((item) => item.id);
  assert.ok(pendingIds.includes(withAsset.id) && pendingIds.includes(withoutAsset.id));
  assert.ok(!pendingIds.includes(harmless.id));
  assert.equal(pending.logs.find((item) => item.id === withAsset.id).scriptName, "Script do log");

  const single = await fetch(`${baseUrl}/api/script-logs/${withAsset.id}`, { headers: { cookie } });
  const singleBody = await single.json();
  assert.equal(single.status, 200);
  assert.equal(singleBody.log.id, withAsset.id);
  assert.equal(singleBody.log.scriptName, "Script do log");
  assert.equal(singleBody.log.errorType, "access_denied");

  assert.equal((await fetch(`${baseUrl}/api/script-logs/inexistente`, { headers: { cookie } })).status, 404);

  const ack = await fetch(`${baseUrl}/api/script-logs/${withoutAsset.id}/acknowledge`, { method: "POST", headers });
  const ackBody = await ack.json();
  assert.equal(ack.status, 200);
  assert.equal(ackBody.log.attentionRequired, false);
  assert.ok(ackBody.log.acknowledgedAt);
  assert.ok(ackBody.log.acknowledgedBy);
  assert.equal((await fetch(`${baseUrl}/api/script-logs/inexistente/acknowledge`, { method: "POST", headers })).status, 404);

  const solution = await fetch(`${baseUrl}/api/script-logs/${withAsset.id}/apply-suggested-solution`, {
    method: "POST",
    headers,
    body: JSON.stringify({ notes: "Acesso revisado manualmente pelo tecnico" })
  });
  const solutionBody = await solution.json();
  assert.equal(solution.status, 200, JSON.stringify(solutionBody));
  assert.equal(solutionBody.log.correctiveActionStatus, "suggested_solution_registered");
  assert.equal(solutionBody.log.correctiveActionNotes, "Acesso revisado manualmente pelo tecnico");
  assert.equal(solutionBody.log.attentionRequired, false);
  assert.ok(solutionBody.log.acknowledgedAt);
  const solutionHistory = await query(
    "SELECT old_value, new_value FROM asset_history WHERE asset_id = $1 AND event_type = 'script_log_solution_registered'",
    [machineId]
  );
  assert.equal(solutionHistory.rowCount, 1);
  assert.equal(solutionHistory.rows[0].old_value, "access_denied");

  const defaultNotes = await fetch(`${baseUrl}/api/script-logs/${withoutAsset.id}/apply-suggested-solution`, {
    method: "POST",
    headers
  });
  const defaultNotesBody = await defaultNotes.json();
  assert.equal(defaultNotes.status, 200);
  assert.match(defaultNotesBody.log.correctiveActionNotes, /Nenhum comando foi executado automaticamente/);
  const noAssetHistory = await query(
    "SELECT COUNT(*)::INTEGER AS total FROM asset_history WHERE event_type = 'script_log_solution_registered'"
  );
  assert.equal(noAssetHistory.rows[0].total, 1, "log sem ativo nao gera historico de ativo");
  const audit = await query("SELECT COUNT(*)::INTEGER AS total FROM audit_logs WHERE type = 'script_log_solution_registered'");
  assert.equal(audit.rows[0].total, 2);

  const missing = await fetch(`${baseUrl}/api/script-logs/inexistente/apply-suggested-solution`, {
    method: "POST",
    headers
  });
  assert.equal(missing.status, 404);

  const afterwards = await (await fetch(`${baseUrl}/api/script-logs/pending`, { headers: { cookie } })).json();
  const afterIds = afterwards.logs.map((item) => item.id);
  assert.ok(!afterIds.includes(withAsset.id) && !afterIds.includes(withoutAsset.id));
});

test("recomendacao por contexto combina ativos, avisos e contexto livre", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const machineId = "recommendation-context-machine";
  await enrollAndHeartbeat(baseUrl, machineId, { operatingSystem: "Microsoft Windows 11 Pro" });
  const alertId = "recommendation-context-alert";
  await createSuggestionForMachine(baseUrl, cookie, machineId, alertId);

  const diskScript = await createScriptViaApi(baseUrl, cookie, {
    name: "Checagem de disco",
    description: "Funciona em Microsoft Windows 11 Pro",
    type: "powershell",
    content: "Get-PhysicalDisk",
    riskLevel: "low",
    category: "Armazenamento",
    relatedAlertTypes: ["disk_health_low"],
    tags: ["disco"]
  });
  const memoryScript = await createScriptViaApi(baseUrl, cookie, {
    name: "Checagem de memoria",
    type: "powershell",
    content: "Get-CimInstance Win32_PhysicalMemory",
    riskLevel: "low",
    category: "Memoria",
    tags: ["memoria", "ram"]
  });
  const quiet = await createScriptViaApi(baseUrl, cookie, {
    name: "Tarefa sem relacao",
    type: "powershell",
    content: "Get-Date",
    riskLevel: "low"
  });

  const recommend = async (payload) => {
    const response = await fetch(`${baseUrl}/api/maintenance-scripts/recommendations`, {
      method: "POST",
      headers: browserHeaders(cookie),
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    return body;
  };

  const byAsset = await recommend({ assetIds: [machineId], context: { tags: ["disco"] } });
  assert.ok(byAsset.contextCount >= 1);
  const diskByAsset = byAsset.recommended.find((item) => item.id === diskScript.id);
  assert.ok(diskByAsset, "script de disco e recomendado para o ativo com aviso de disco");
  assert.deepEqual(diskByAsset.matchedAssetIds, [machineId]);
  assert.deepEqual(diskByAsset.matchedAlertIds, [alertId], "avisos ativos do ativo entram no contexto");
  assert.equal(byAsset.context.assetId, machineId);
  assert.equal(byAsset.context.assetType, "desktop", "o tipo do ativo vem do inventario");

  const byAlert = await recommend({ alertIds: [alertId, "aviso-inexistente"] });
  assert.ok(byAlert.recommended.some((item) => item.id === diskScript.id));
  assert.equal(byAlert.context.alertId, alertId);
  assert.deepEqual(byAlert.recommended.find((item) => item.id === diskScript.id).matchedAssetIds, [machineId]);

  const freeContext = await recommend({ context: { title: "Memoria RAM esgotada no servidor", alertType: "memory" } });
  assert.equal(freeContext.contextCount, 1);
  assert.ok(freeContext.recommended.some((item) => item.id === memoryScript.id));
  const scoreOf = (name) => freeContext.recommended.find((item) => item.name === name)?.recommendationScore ?? 0;
  assert.ok(scoreOf("Checagem de memoria") > scoreOf(quiet.name), "script de memoria ranqueia acima do sem relacao");
  assert.ok(freeContext.others.every((item) => item.isRecommended === false));
  assert.deepEqual(freeContext.recommended.find((item) => item.id === memoryScript.id).matchedAssetIds, []);

  const byOperatingSystem = await recommend({
    context: { title: "Falha no disco", operatingSystem: "Microsoft Windows 11 Pro", assetType: "desktop" }
  });
  const osMatch = byOperatingSystem.recommended.find((item) => item.id === diskScript.id);
  assert.match(osMatch.recommendationReason, /sistema operacional compativel/);

  const empty = await recommend({});
  assert.equal(empty.contextCount, 1);
  assert.deepEqual(empty.context, { tags: [] });
  assert.ok(empty.others.length > 0);

  const unknownAsset = await recommend({ assetIds: ["ativo-que-nao-existe"], context: { title: "disco" } });
  assert.equal(unknownAsset.contextCount, 1);
  for (const item of [...unknownAsset.recommended, ...unknownAsset.others]) {
    assert.deepEqual(item.matchedAssetIds, []);
  }
});
