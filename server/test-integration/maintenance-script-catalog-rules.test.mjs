import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "maintenance-script-catalog-rules-secret-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { seedDefaultMaintenanceScripts } = await import("../src/services/maintenanceScripts/maintenanceScriptsFacade.js");
const {
  browserHeaders,
  bearerHeaders,
  bearerUser,
  createScriptViaApi,
  createServiceOrderViaApi,
  enrollAndHeartbeat,
  listen,
  login
} = await import("../test-support/scriptFixtures.mjs");

const basePath = "/api/maintenance-scripts";

test.after(closeDatabase);

async function startServer(t) {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  return { baseUrl, cookie };
}

async function analyze(baseUrl, cookie, content) {
  const response = await fetch(`${baseUrl}${basePath}/analyze`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify(content === undefined ? {} : { content })
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.analysis;
}

test("analise de conteudo: vazio, variaveis permitidas e desconhecidas, padroes de risco e texto de script", async (t) => {
  const { baseUrl, cookie } = await startServer(t);

  const withoutBody = await analyze(baseUrl, cookie, undefined);
  assert.equal(withoutBody.suggestedRiskLevel, "medium");
  assert.match(withoutBody.estimatedSummary, /Nenhum conteúdo informado/);
  assert.deepEqual(withoutBody.detectedVariables, []);
  assert.equal(withoutBody.safePreview, "");
  assert.ok(withoutBody.allowedVariables.some((item) => item.key === "HOSTNAME" && item.name === "{{HOSTNAME}}"));
  assert.equal(withoutBody.safetyWarnings[0], "Nenhum comando foi executado.");

  const blank = await analyze(baseUrl, cookie, "   \n  ");
  assert.equal(blank.suggestedRiskLevel, "medium");
  assert.equal(blank.variableValidationStatus, "valid");

  const withVariables = await analyze(baseUrl, cookie, "Write-Host {{HOSTNAME}} {{ asset_ip }} {{SEGREDO}} {{hostname}}");
  assert.deepEqual(withVariables.detectedVariables, ["{{HOSTNAME}}", "{{ASSET_IP}}"]);
  assert.deepEqual(withVariables.unknownVariables, ["{{SEGREDO}}"]);
  assert.equal(withVariables.variableValidationStatus, "invalid");
  assert.deepEqual(
    withVariables.variableDetails.map((item) => item.key),
    ["HOSTNAME", "ASSET_IP"]
  );

  const highRisk = await analyze(baseUrl, cookie, "Restart-Service Spooler\nshutdown /r /t 0\nRemove-Item C:\\temp -Recurse\nreg add HKCU\\x");
  assert.equal(highRisk.suggestedRiskLevel, "high");
  assert.ok(highRisk.detectedActions.length >= 3);
  assert.match(highRisk.estimatedSummary, /serviços do sistema/);

  // A analise e consultiva: um padrao critico apenas sugere o nivel, nao bloqueia.
  const critical = await analyze(baseUrl, cookie, "diskpart");
  assert.equal(critical.suggestedRiskLevel, "critical");

  const htmlText = await analyze(baseUrl, cookie, "<script>alert(1)</script>");
  assert.equal(htmlText.suggestedRiskLevel, "medium");
  assert.ok(htmlText.detectedActions.includes("Conteúdo contém marcação de script em texto."));

  const mediumFlush = await analyze(baseUrl, cookie, "ipconfig /flushdns");
  assert.equal(mediumFlush.suggestedRiskLevel, "medium");

  const lowInfo = await analyze(baseUrl, cookie, "whoami");
  assert.equal(lowInfo.suggestedRiskLevel, "low");

  const noPattern = await analyze(baseUrl, cookie, "Write-Output 'oi'");
  assert.equal(noPattern.suggestedRiskLevel, "low");
  assert.deepEqual(noPattern.detectedActions, []);
  assert.match(noPattern.estimatedSummary, /Não foram identificados padrões conhecidos/);
});

test("cadastro normaliza listas, variaveis, flags, tipo, risco e limites de tamanho", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const adminProfile = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
  const adminId = (await adminProfile.json()).user?.id;

  const script = await createScriptViaApi(baseUrl, cookie, {
    name: `  ${"N".repeat(150)}  `,
    description: "D".repeat(600),
    type: "TypeInvalido",
    content: "Write-Host {{HOSTNAME}} {{ASSET_NAME}}",
    category: "Rede",
    riskLevel: "extremo",
    tags: "rede, wifi, rede,  ,dns",
    relatedAlertTypes: '["ping_failure","ping_failure","network"]',
    relatedProblemTypes: "[quebrado,json",
    recommendedForCategories: ["Rede", "Rede"],
    supportedVariables: ["{{CURRENT_USER}}", "hostname", "NAO_EXISTE"],
    requiresAdmin: "true",
    requiresLoggedUser: "false",
    requiresConfirmation: "false",
    active: "false",
    alertType: "ping_failure",
    problemType: "Internet lenta"
  });

  assert.equal(script.name.length, 120);
  assert.equal(script.description.length, 500);
  assert.equal(script.type, "other", "tipo desconhecido vira 'other'");
  assert.equal(script.riskLevel, "low", "risco invalido assume o sugerido pela analise");
  assert.equal(script.suggestedRiskLevel, "low");
  assert.deepEqual(script.tags, ["rede", "wifi", "dns"]);
  assert.deepEqual(script.relatedAlertTypes, ["ping_failure", "network"]);
  assert.deepEqual(script.relatedProblemTypes, ["[quebrado", "json"]);
  assert.deepEqual(script.recommendedForCategories, ["Rede"]);
  assert.deepEqual(script.supportedVariables, ["CURRENT_USER", "HOSTNAME", "ASSET_NAME"]);
  assert.equal(script.requiresAdmin, true);
  assert.equal(script.requiresLoggedUser, false);
  assert.equal(script.requiresConfirmation, false);
  assert.equal(script.active, false);
  assert.equal(script.alertType, "ping_failure");
  assert.equal(script.problemType, "Internet lenta");
  assert.equal(script.variableValidationStatus, "valid");
  assert.equal(script.createdBy, adminId);
  assert.equal(script.contentUpdatedBy, adminId);
  assert.match(script.estimatedSummary, /informações básicas da máquina/);

  const truncated = await createScriptViaApi(baseUrl, cookie, {
    name: "Conteudo muito longo",
    type: "powershell",
    content: `Write-Output 'a'\n${"x".repeat(12000)}`
  });
  assert.equal(truncated.content.length, 10000, "o conteudo e truncado em 10000 caracteres");

  const withoutDefaults = await createScriptViaApi(baseUrl, cookie, {
    name: "Padroes de cadastro",
    type: "cmd",
    content: "Restart-Service Spooler"
  });
  assert.equal(withoutDefaults.riskLevel, "high", "sem riskLevel assume o risco sugerido pela analise");
  assert.equal(withoutDefaults.requiresConfirmation, true);
  assert.equal(withoutDefaults.active, true);
  assert.equal(withoutDefaults.requiresAdmin, false);
  assert.deepEqual(withoutDefaults.tags, []);
});

test("cadastro recusa conteudo perigoso, variavel desconhecida e dados obrigatorios ausentes", async (t) => {
  const { baseUrl, cookie } = await startServer(t);

  const dangerous = await fetch(baseUrl + basePath, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ name: "Script perigoso", type: "powershell", content: "bcdedit /set safeboot minimal" })
  });
  const dangerousBody = await dangerous.json();
  assert.equal(dangerous.status, 400);
  assert.match(dangerousBody.message, /Conteudo do script bloqueado/);

  const unknownVariable = await fetch(baseUrl + basePath, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ name: "Variavel invalida", type: "powershell", content: "Write-Host {{SENHA_ADMIN}}" })
  });
  const unknownBody = await unknownVariable.json();
  assert.equal(unknownVariable.status, 400);
  assert.match(unknownBody.message, /Variaveis nao permitidas no script: \{\{SENHA_ADMIN\}\}/);

  for (const body of [{ name: "ab", content: "x" }, { name: "Sem conteudo" }, { content: "x" }, {}]) {
    const response = await fetch(baseUrl + basePath, {
      method: "POST",
      headers: browserHeaders(cookie),
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test("atualizacao mescla campos, revalida conteudo, atribui o ultimo editor e responde 404 para id inexistente", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const created = await createScriptViaApi(baseUrl, cookie, {
    name: "Script para atualizar",
    type: "powershell",
    content: "Get-Service",
    riskLevel: "low",
    tags: ["servicos"],
    category: "Sistema"
  });

  const rename = await fetch(`${baseUrl}${basePath}/${created.id}`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ name: "Script renomeado", requiresAdmin: true })
  });
  const renamed = (await rename.json()).script;
  assert.equal(rename.status, 200);
  assert.equal(renamed.name, "Script renomeado");
  assert.equal(renamed.content, "Get-Service", "o conteudo anterior e preservado");
  assert.deepEqual(renamed.tags, ["servicos"]);
  assert.equal(renamed.category, "Sistema");
  assert.equal(renamed.requiresAdmin, true);
  assert.equal(renamed.riskLevel, "low");

  const dangerousUpdate = await fetch(`${baseUrl}${basePath}/${created.id}`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ content: "schtasks /create /tn x /tr y" })
  });
  assert.equal(dangerousUpdate.status, 400);
  const stored = await query("SELECT content FROM maintenance_scripts WHERE id = $1", [created.id]);
  assert.equal(stored.rows[0].content, "Get-Service", "conteudo recusado nao pode ser gravado");

  const { user: editor, token: editorToken } = await bearerUser({ role: "admin", permissions: ["scripts.manage"] });
  const editedByOther = await fetch(`${baseUrl}${basePath}/${created.id}`, {
    method: "PATCH",
    headers: bearerHeaders(editorToken),
    body: JSON.stringify({ content: "Get-Process" })
  });
  assert.equal(editedByOther.status, 200);
  const afterEdit = await query("SELECT content, content_updated_by FROM maintenance_scripts WHERE id = $1", [created.id]);
  assert.equal(afterEdit.rows[0].content, "Get-Process");
  assert.equal(afterEdit.rows[0].content_updated_by, editor.id, "o ultimo editor do conteudo e registrado");
  assert.notEqual(afterEdit.rows[0].content_updated_by, created.createdBy);

  const missingUpdate = await fetch(`${baseUrl}${basePath}/inexistente`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ name: "Qualquer nome" })
  });
  assert.equal(missingUpdate.status, 404);

  const missingDelete = await fetch(`${baseUrl}${basePath}/inexistente`, {
    method: "DELETE",
    headers: browserHeaders(cookie)
  });
  assert.equal(missingDelete.status, 404);
});

test("listagem coloca ativos primeiro e includeInactive=false oculta desativados", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const active = await createScriptViaApi(baseUrl, cookie, { name: "Script ativo da lista", type: "cmd", content: "hostname" });
  const inactive = await createScriptViaApi(baseUrl, cookie, {
    name: "Script inativo da lista",
    type: "cmd",
    content: "hostname",
    active: false
  });

  const all = (await (await fetch(baseUrl + basePath, { headers: { cookie } })).json()).scripts;
  const activeIndex = all.findIndex((item) => item.id === active.id);
  const inactiveIndex = all.findIndex((item) => item.id === inactive.id);
  assert.ok(activeIndex >= 0 && inactiveIndex >= 0);
  assert.ok(activeIndex < inactiveIndex, "ativos vem antes dos inativos");

  const onlyActive = (await (await fetch(`${baseUrl}${basePath}?includeInactive=false`, { headers: { cookie } })).json()).scripts;
  assert.ok(onlyActive.some((item) => item.id === active.id));
  assert.ok(!onlyActive.some((item) => item.id === inactive.id));
  assert.ok(onlyActive.every((item) => item.active === true));
});

test("semente dos scripts padrao e idempotente e restaura a definicao oficial", async (t) => {
  await startServer(t);

  const countDefaults = async () => (
    await query("SELECT COUNT(*)::INTEGER AS total FROM maintenance_scripts WHERE id LIKE 'demo-script-%'")
  ).rows[0].total;

  await seedDefaultMaintenanceScripts();
  const initial = await countDefaults();
  assert.equal(initial, 4);

  await query(
    "UPDATE maintenance_scripts SET name = 'Nome adulterado', active = FALSE, content = 'echo alterado' WHERE id = 'demo-script-disk-check'"
  );
  await seedDefaultMaintenanceScripts();

  assert.equal(await countDefaults(), initial, "reexecutar a semente nao duplica scripts");
  const restored = (await query(
    "SELECT name, active, content, risk_level, requires_confirmation, tags FROM maintenance_scripts WHERE id = 'demo-script-disk-check'"
  )).rows[0];
  assert.equal(restored.name, "Verificação de disco");
  assert.equal(restored.active, true);
  assert.match(restored.content, /Get-PhysicalDisk/);
  assert.equal(restored.risk_level, "medium");
  assert.equal(restored.requires_confirmation, true);
  assert.deepEqual(restored.tags, ["disco", "armazenamento", "hardware"]);
});

test("simulacao exige confirmacao, script ativo e confirmacao extra para risco alto, e grava historicos", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const machineId = "script-simulation-machine";
  await enrollAndHeartbeat(baseUrl, machineId);
  const order = await createServiceOrderViaApi(baseUrl, cookie, { title: "OS para simulacao", assetId: machineId });
  const lowScript = await createScriptViaApi(baseUrl, cookie, {
    name: "Simulacao de baixo risco",
    type: "powershell",
    content: "hostname",
    riskLevel: "low"
  });
  const highScript = await createScriptViaApi(baseUrl, cookie, {
    name: "Simulacao de alto risco",
    type: "powershell",
    content: "Restart-Service Spooler",
    riskLevel: "high"
  });
  const simulate = (scriptId, body) => fetch(`${baseUrl}${basePath}/${scriptId}/register-simulation`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify(body)
  });

  const missing = await simulate("nao-existe", { confirmed: true });
  assert.equal(missing.status, 404);

  const highWithoutAck = await simulate(highScript.id, { confirmed: true });
  assert.equal(highWithoutAck.status, 400);
  assert.match((await highWithoutAck.json()).message, /alto risco exigem confirmação extra/);

  const highWithAck = await simulate(highScript.id, { confirmed: true, riskAcknowledged: true, mode: "prepared" });
  const highBody = await highWithAck.json();
  assert.equal(highWithAck.status, 201, JSON.stringify(highBody));
  assert.equal(highBody.log.mode, "prepared");

  const full = await simulate(lowScript.id, {
    confirmed: true,
    assetId: machineId,
    serviceOrderId: order.id,
    notes: "Observacao do tecnico",
    mode: "modo-invalido"
  });
  const fullBody = await full.json();
  assert.equal(full.status, 201, JSON.stringify(fullBody));
  assert.equal(fullBody.log.mode, "simulated", "modo desconhecido volta para 'simulated'");
  assert.equal(fullBody.log.assetId, machineId);
  assert.equal(fullBody.log.serviceOrderId, order.id);
  assert.equal(fullBody.log.notes, "Observacao do tecnico");
  assert.equal(fullBody.log.status, "registered");
  assert.equal(fullBody.script.id, lowScript.id);

  const assetHistory = await query(
    "SELECT message FROM asset_history WHERE asset_id = $1 AND event_type = 'script_simulation'",
    [machineId]
  );
  assert.equal(assetHistory.rowCount, 1);
  assert.match(assetHistory.rows[0].message, /Nenhum comando foi executado/);
  const orderHistory = await query(
    "SELECT message FROM service_order_history WHERE service_order_id = $1 AND event_type = 'script_simulation'",
    [order.id]
  );
  assert.equal(orderHistory.rowCount, 1);
  const audit = await query("SELECT meta FROM audit_logs WHERE type = 'maintenance_script_simulation'");
  assert.ok(audit.rowCount >= 2);

  await fetch(`${baseUrl}${basePath}/${lowScript.id}`, { method: "DELETE", headers: browserHeaders(cookie) });
  const inactive = await simulate(lowScript.id, { confirmed: true });
  assert.equal(inactive.status, 404, "script desativado nao aceita novas simulacoes");
});
