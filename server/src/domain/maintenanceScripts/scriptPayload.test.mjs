import assert from "node:assert/strict";
import test from "node:test";

import { analyzeMaintenanceScriptContent } from "./contentAnalysis.js";
import {
  normalizeComparableText,
  normalizeTextList,
  normalizeTokenList,
  normalizeVariableList,
  parseArrayValue
} from "./listNormalization.js";
import { interpretScriptLogWithMetadata } from "./logInterpretation.js";
import { normalizeScriptPayload } from "./scriptPayload.js";
import { normalizeRiskLevel, normalizeScriptType, resolveScriptRiskLevel } from "./scriptVocabulary.js";

test("listas aceitam array, texto separado por virgula, JSON e valores invalidos", () => {
  assert.deepEqual(parseArrayValue(["a", "b"]), ["a", "b"]);
  assert.deepEqual(parseArrayValue("a, b"), ["a", " b"]);
  assert.deepEqual(parseArrayValue('["x","y"]'), ["x", "y"]);
  assert.deepEqual(parseArrayValue("[x,y]"), ["[x", "y]"], "JSON invalido cai para separacao por virgula");
  assert.deepEqual(parseArrayValue('{"a":1}'), ['{"a":1}']);
  assert.deepEqual(parseArrayValue("   "), []);
  assert.deepEqual(parseArrayValue(null), []);
  assert.deepEqual(parseArrayValue(42), []);

  assert.deepEqual(normalizeTextList(" rede , wifi,rede,, "), ["rede", "wifi"]);
  assert.deepEqual(normalizeTextList(["x".repeat(100)])[0].length, 80);
  assert.equal(normalizeComparableText("  Conexão ÀGUA-Fria!  "), "conexao agua fria");
  assert.equal(normalizeComparableText(null), "");
  assert.deepEqual(normalizeTokenList("Disco Rígido, REDE,"), ["disco rigido", "rede"]);
  assert.deepEqual(normalizeVariableList(["{{hostname}}", "HOSTNAME", "Nao_Existe", " asset_ip "]), ["HOSTNAME", "ASSET_IP"]);
});

test("vocabulario normaliza tipo e risco", () => {
  assert.equal(normalizeScriptType(" PowerShell "), "powershell");
  assert.equal(normalizeScriptType("exe"), "other");
  assert.equal(normalizeScriptType(undefined), "other");
  assert.equal(normalizeRiskLevel(" HIGH "), "high");
  assert.equal(normalizeRiskLevel("nada", "low"), "low");
  assert.equal(resolveScriptRiskLevel({ riskLevel: "low", suggestedRiskLevel: "critical" }), "low");
  assert.equal(resolveScriptRiskLevel({ suggestedRiskLevel: "critical" }), "critical");
  assert.equal(resolveScriptRiskLevel({}), "medium");
});

test("normaliza o payload de cadastro e mescla com o cadastro atual", () => {
  const created = normalizeScriptPayload({
    name: "  Limpar cache DNS  ",
    content: "ipconfig /flushdns",
    type: "CMD",
    tags: "dns, rede",
    requiresAdmin: "true",
    active: "false"
  });
  assert.equal(created.name, "Limpar cache DNS");
  assert.equal(created.type, "cmd");
  assert.deepEqual(created.tags, ["dns", "rede"]);
  assert.equal(created.requiresAdmin, true);
  assert.equal(created.active, false);
  assert.equal(created.requiresConfirmation, true);
  assert.equal(created.riskLevel, "medium", "risco assume o sugerido pela analise (flushdns e medio)");
  assert.equal(created.safePreview, "ipconfig /flushdns");
  assert.equal(created.variableValidationStatus, "valid");

  const merged = normalizeScriptPayload({ description: "Nova descricao" }, created);
  assert.equal(merged.name, "Limpar cache DNS");
  assert.equal(merged.content, "ipconfig /flushdns");
  assert.equal(merged.description, "Nova descricao");
  assert.equal(merged.riskLevel, "medium");
  assert.equal(merged.active, false);
  assert.deepEqual(merged.tags, ["dns", "rede"]);
});

test("payload invalido e recusado antes de qualquer gravacao", () => {
  const cases = [
    [{ name: "ab", content: "x" }, /nome de script/],
    [{ name: "Valido", content: "   " }, /conteúdo do script/],
    [{ name: "Valido", content: "diskpart" }, /bloqueado/],
    [{ name: "Valido", content: "echo {{SEGREDO}}" }, /Variaveis nao permitidas/]
  ];
  for (const [payload, message] of cases) {
    assert.throws(() => normalizeScriptPayload(payload), (error) => error.statusCode === 400 && message.test(error.message));
  }
  assert.throws(() => normalizeScriptPayload({}, { name: "Atual", content: "" }), (error) => error.statusCode === 400);
});

test("variaveis detectadas no conteudo entram nas variaveis suportadas", () => {
  const script = normalizeScriptPayload({
    name: "Com variaveis",
    content: "echo {{HOSTNAME}} {{CURRENT_USER}}",
    supportedVariables: ["TEMP_DIR", "desconhecida"]
  });
  assert.deepEqual(script.supportedVariables, ["TEMP_DIR", "HOSTNAME", "CURRENT_USER"]);
  assert.equal(analyzeMaintenanceScriptContent("{{HOSTNAME}}").variableValidationStatus, "valid");
});

test("interpretacao do log reconhece padroes e preserva o estado quando nao ha erro", () => {
  assert.equal(interpretScriptLogWithMetadata("Access denied", "registered").errorType, "access_denied");
  assert.equal(interpretScriptLogWithMetadata("tudo ok", "queued").status, "queued");
  assert.equal(interpretScriptLogWithMetadata("tudo ok", "error").status, "registered");
  assert.equal(interpretScriptLogWithMetadata("", "queued").parsedSummary, "Nenhum log de script disponível.");
  assert.equal(interpretScriptLogWithMetadata(undefined).status, "registered");
  assert.equal(interpretScriptLogWithMetadata("   ", "x").errorDetected, false);

  const first = interpretScriptLogWithMetadata("acesso negado e timeout", "registered");
  assert.equal(first.errorType, "access_denied", "a primeira regra que combina vence");
  assert.equal(first.errorSeverity, "high");
  assert.equal(first.requiresAdmin, true);
});
